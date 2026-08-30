import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import verifyToken from "../middleware/auth.js";
import Report from "../models/Report.js";
import ScanResult from "../models/ScanResult.js";
import { generatePDF, generateDOCX, generateJSON, generateMarkdown, generateHackerOne, generateBugcrowd, generateIntigriti, generateYesWeHack } from "../services/reportGenerator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.join(__dirname, "..", "reports");

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const router = Router();

// POST /api/report/generate - Generate a report from a scan
router.post("/generate", verifyToken, async (req, res) => {
  try {
    const { scanId, format } = req.body;

    if (!scanId) {
      return res.status(400).json({ message: "scanId is required" });
    }

    const validFormats = ["pdf", "docx", "json", "md", "hackerone", "bugcrowd", "intigriti", "yeswehack"];
    const fmt = validFormats.includes(format) ? format : "pdf";

    // Fetch scan result
    const scanResult = await ScanResult.findOne({
      _id: scanId,
      userId: req.userId,
    });

    if (!scanResult) {
      return res.status(404).json({ message: "Scan not found" });
    }

    // Generate report buffer
    let buffer;
    if (fmt === "pdf") {
      buffer = await generatePDF(scanResult);
    } else if (fmt === "docx") {
      buffer = await generateDOCX(scanResult);
    } else if (fmt === "md") {
      buffer = generateMarkdown(scanResult);
    } else if (fmt === "hackerone") {
      buffer = generateHackerOne(scanResult);
    } else if (fmt === "bugcrowd") {
      buffer = generateBugcrowd(scanResult);
    } else if (fmt === "intigriti") {
      buffer = generateIntigriti(scanResult);
    } else if (fmt === "yeswehack") {
      buffer = generateYesWeHack(scanResult);
    } else {
      buffer = generateJSON(scanResult);
    }

    // Save to disk
    const userDir = path.join(REPORTS_DIR, req.userId.toString());
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extMap = { pdf: "pdf", docx: "docx", json: "json", md: "md", hackerone: "md", bugcrowd: "md", intigriti: "md", yeswehack: "md" };
    const ext = extMap[fmt] || fmt;
    const isSpecial = ["hackerone", "bugcrowd", "intigriti", "yeswehack"].includes(fmt);
    const fileName = `scan_report_${isSpecial ? fmt + "_" : ""}${timestamp}.${ext}`;
    const filePath = path.join(userDir, fileName);

    fs.writeFileSync(filePath, buffer);

    // Compute report summary data
    const findings = scanResult.activeScan?.findings || [];
    const confirmed = findings.filter((f) => f.status === "CONFIRMED").length;
    const potential = findings.length - confirmed;
    const categories = scanResult.activeScan?.summary?.categories_tested || [];

    // Save metadata to DB
    const report = new Report({
      userId: req.userId,
      scanId: scanResult._id,
      fileName,
      format: fmt,
      filePath: path.relative(REPORTS_DIR, filePath),
      targetUrl: scanResult.url,
      fileSize: buffer.length,
      reportData: {
        totalFindings: findings.length,
        confirmedFindings: confirmed,
        potentialFindings: potential,
        categoriesTested: categories,
      },
    });
    await report.save();

    res.json({
      reportId: report._id,
      fileName: report.fileName,
      format: report.format,
      fileSize: report.fileSize,
      downloadUrl: `/api/report/download/${report._id}`,
      viewUrl: `/api/report/view/${report._id}`,
    });
  } catch (error) {
    console.error("Report generation error:", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

// GET /api/report/list - List user's reports
router.get("/list", verifyToken, async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("-__v");

    res.json(reports);
  } catch (error) {
    console.error("List reports error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/report/download/:id - Download a report file
router.get("/download/:id", verifyToken, async (req, res) => {
  try {
    const report = await Report.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const filePath = path.join(REPORTS_DIR, report.filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Report file not found on disk" });
    }

    const mimeTypes = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      json: "application/json",
      md: "text/markdown",
      hackerone: "text/markdown",
      bugcrowd: "text/markdown",
      intigriti: "text/markdown",
      yeswehack: "text/markdown",
    };

    res.setHeader("Content-Type", mimeTypes[report.format] || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${report.fileName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on("error", (err) => {
      console.error("File stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error reading report file" });
      }
    });
  } catch (error) {
    console.error("Download report error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal server error" });
    }
  }
});

// GET /api/report/view/:id - View report in browser
router.get("/view/:id", verifyToken, async (req, res) => {
  try {
    const report = await Report.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const filePath = path.join(REPORTS_DIR, report.filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Report file not found on disk" });
    }

    const mimeTypes = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      json: "application/json",
      md: "text/markdown",
      hackerone: "text/markdown",
      bugcrowd: "text/markdown",
      intigriti: "text/markdown",
      yeswehack: "text/markdown",
    };

    res.setHeader("Content-Type", mimeTypes[report.format] || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${report.fileName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on("error", (err) => {
      console.error("File stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error reading report file" });
      }
    });
  } catch (error) {
    console.error("View report error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal server error" });
    }
  }
});

// DELETE /api/report/:id - Delete a report
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const report = await Report.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Delete file from disk
    const filePath = path.join(REPORTS_DIR, report.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from DB
    await Report.deleteOne({ _id: report._id });

    res.json({ message: "Report deleted" });
  } catch (error) {
    console.error("Delete report error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
