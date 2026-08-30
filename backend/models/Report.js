import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ScanResult",
    },
    fileName: {
      type: String,
      required: true,
    },
    format: {
      type: String,
      enum: ["pdf", "docx", "json", "md", "hackerone", "bugcrowd", "intigriti", "yeswehack"],
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    targetUrl: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    reportData: {
      totalFindings: { type: Number, default: 0 },
      confirmedFindings: { type: Number, default: 0 },
      potentialFindings: { type: Number, default: 0 },
      categoriesTested: [String],
    },
  },
  { timestamps: true }
);

const Report = mongoose.model("Report", reportSchema);

export default Report;
