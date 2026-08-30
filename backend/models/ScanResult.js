import mongoose from "mongoose";

const scanResultSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["in_progress", "completed", "failed"],
      default: "in_progress",
    },
    vulnerabilityCount: { type: Number, default: 0 },
    scanDuration: Number,
    passiveScan: {
      headers: { type: Object, default: {} },
      techStack: [String],
      missingHeaders: [String],
      serverInfo: String,
      statusCode: Number,
    },
    predictions: [
      {
        category: String,
        confidence: Number,
        percentage: Number,
        risk_level: String,
        reasons: [String],
        evidence_count: Number,
      },
    ],
    severityPrediction: {
      name: String,
      confidence: Number,
    },
    activeScan: {
      findings: [
        {
          category: String,
          severity: String,
          confidence: Number,
          status: String,
          payload: String,
          url: String,
          method: String,
          evidence: String,
          description: String,
          remediation: String,
          ai_verified_by: String,
        },
      ],
      summary: {
        total_tests: Number,
        confirmed: Number,
        potential: Number,
        categories_tested: [String],
      },
      aiModels: {
        payload_generator: String,
        verifier: String,
        ollama_available: Boolean,
      },
      scanDuration: Number,
      completedAt: Date,
    },
    scanDate: {
      type: Date,
      default: Date.now,
    },
    scanDuration: Number,
    error: String,
  },
  { timestamps: true }
);

const ScanResult = mongoose.model("ScanResult", scanResultSchema);

export default ScanResult;
