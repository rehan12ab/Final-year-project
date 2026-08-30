import { Router } from "express";
import verifyToken from "../middleware/auth.js";
import ScanResult from "../models/ScanResult.js";

const router = Router();

const PYTHON_API = process.env.PYTHON_API_URL || "http://localhost:8000";

// GET /api/scan/ai-status - Check Ollama + hacksentinel-8b availability
router.get("/ai-status", verifyToken, async (req, res) => {
  try {
    const resp = await fetch(`${PYTHON_API}/health`);
    if (!resp.ok) {
      return res.status(502).json({ available: false, models: {}, error: "Python API unreachable" });
    }
    const data = await resp.json();
    const ollama = data.ollama || { available: false, models: {} };
    res.json({
      available: ollama.available,
      models: ollama.models || {},
      python_api: data.status === "ok",
    });
  } catch (err) {
    res.status(502).json({ available: false, models: {}, error: err.message });
  }
});

// POST /api/scan/passive - Run passive scan via Python FastAPI
router.post("/passive", verifyToken, async (req, res) => {
  try {
    let { url, userId } = req.body;
    
    // Support internal agent calls
    if (!req.userId && req.headers['x-internal-key'] === process.env.JWT_SECRET) {
      req.userId = userId;
    }

    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return res.status(400).json({ message: "URL is required" });
    }

    // Validate URL format
    const trimmedUrl = url.trim();
    try {
      new URL(
        trimmedUrl.startsWith("http") ? trimmedUrl : `https://${trimmedUrl}`
      );
    } catch {
      return res.status(400).json({ message: "Invalid URL format" });
    }

    // Create scan record
    const scanResult = new ScanResult({
      userId: req.userId,
      url: trimmedUrl,
      status: "in_progress",
    });
    await scanResult.save();

    // Proxy to Python FastAPI
    let pythonResponse;
    try {
      const resp = await fetch(`${PYTHON_API}/api/scan/passive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`Python API error (${resp.status}): ${errBody}`);
      }

      pythonResponse = await resp.json();
    } catch (fetchErr) {
      // Update scan as failed
      scanResult.status = "failed";
      scanResult.error = fetchErr.message;
      await scanResult.save();

      return res.status(502).json({
        message: "Prediction service unavailable",
        error: fetchErr.message,
        scanId: scanResult._id,
      });
    }

    // Update scan record with results
    scanResult.status = "completed";
    scanResult.passiveScan = {
      headers: pythonResponse.headers || {},
      techStack: pythonResponse.tech_stack || [],
      missingHeaders: pythonResponse.missing_headers || [],
      serverInfo: pythonResponse.server_info || "",
      statusCode: pythonResponse.status_code,
    };
    scanResult.predictions = (pythonResponse.predictions || []).map((p) => ({
      category: p.name,
      confidence: p.confidence,
      percentage: p.percentage,
      risk_level: p.risk_level,
      reasons: p.reasons || [],
      evidence_count: p.evidence_count || 0,
    }));
    scanResult.severityPrediction = pythonResponse.severity_prediction || {};
    scanResult.scanDuration = pythonResponse.scan_duration;
    await scanResult.save();

    res.json({
      scanId: scanResult._id,
      ...pythonResponse,
    });
  } catch (error) {
    console.error("Passive scan error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/scan/active - Run active vulnerability tests via Python FastAPI
router.post("/active", verifyToken, async (req, res) => {
  try {
    const { scanId, url, categories, tech_stack } = req.body;

    if (!url || !categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ message: "URL and categories are required" });
    }

    // Proxy to Python FastAPI active scan
    let pythonResponse;
    try {
      const resp = await fetch(`${PYTHON_API}/api/scan/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, categories, tech_stack: tech_stack || [] }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`Python API error (${resp.status}): ${errBody}`);
      }

      pythonResponse = await resp.json();
    } catch (fetchErr) {
      console.error("[ActiveScan] Python API Connection Failed:", fetchErr);
      return res.status(502).json({
        message: "Active scan service unavailable",
        error: fetchErr.message,
        tip: "Please ensure your Python FastAPI engine (predict_api.py) is running on port 8000."
      });
    }

    // Update ScanResult if scanId provided
    if (scanId) {
      try {
        const findings = pythonResponse.findings || [];
        console.log(`[ActiveScan] Found ${findings.length} vulnerabilities for scanId: ${scanId}`);
        
        const verifierModel = findings.find(f => f.ai_verified_by)?.ai_verified_by || "hacksentinel-8b";
        
        const updateData = {
          vulnerabilityCount: findings.length,
          scanDuration: pythonResponse.duration || 0,
          scanDate: new Date(),
          activeScan: {
            findings: findings.map((f) => ({
              category: f.category,
              severity: f.severity || "medium",
              confidence: f.confidence || 0,
              status: f.status || "POTENTIAL",
              payload: f.payload,
              url: f.url,
              method: f.method || "GET",
              evidence: f.evidence || "",
              description: f.description || "",
              remediation: f.remediation || "",
              ai_verified_by: f.ai_verified_by || verifierModel,
            })),
            summary: pythonResponse.summary || {
              total_tests: findings.length,
              confirmed: findings.filter(f => f.status === 'CONFIRMED').length,
              potential: findings.filter(f => f.status === 'POTENTIAL').length,
              categories_tested: categories
            },
            aiModels: {
              payload_generator: "llama3",
              verifier: verifierModel,
              ollama_available: pythonResponse.summary?.ollama_available ?? true,
            },
            scanDuration: pythonResponse.duration || 0,
            completedAt: new Date(),
          },
        };

        const updated = await ScanResult.findOneAndUpdate(
          { _id: scanId, userId: req.userId },
          updateData,
          { new: true }
        );
        
        if (!updated) {
          console.warn(`[ActiveScan] No scan record found with id: ${scanId} for user: ${req.userId}`);
        } else {
          console.log(`[ActiveScan] Successfully updated scan record: ${scanId}`);
        }
      } catch (dbErr) {
        console.error("Failed to update scan with active results:", dbErr);
      }
    }

    res.json(pythonResponse);
  } catch (error) {
    console.error("Active scan error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/scan/history - Get user's scan history
router.get("/history", verifyToken, async (req, res) => {
  try {
    const scans = await ScanResult.find({ userId: req.userId })
      .sort({ scanDate: -1 })
      .limit(50)
      .select("-__v");

    res.json(scans);
  } catch (error) {
    console.error("Scan history error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/scan/:id - Get specific scan result
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const scan = await ScanResult.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).select("-__v");

    if (!scan) {
      return res.status(404).json({ message: "Scan not found" });
    }

    res.json(scan);
  } catch (error) {
    console.error("Get scan error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/scan/:id - Delete a scan history entry
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const scan = await ScanResult.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!scan) {
      return res.status(404).json({ message: "Scan not found" });
    }

    res.json({ message: "Scan deleted" });
  } catch (error) {
    console.error("Delete scan error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
