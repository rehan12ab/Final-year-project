import PDFDocument from "pdfkit";
import fs from "fs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ImageRun,
  PageBreak,
} from "docx";

// ======================== SEVERITY COLOR MAPS ========================

const SEVERITY_COLORS = {
  critical: "#dc2626",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  informational: "#64748b",
  info: "#64748b",
};

const SEVERITY_COLORS_RGB = {
  critical: [220, 38, 38],
  high: [249, 115, 22],
  medium: [234, 179, 8],
  low: [59, 130, 246],
  informational: [100, 116, 139],
  info: [100, 116, 139],
};

// ======================== SHARED LOOKUP TABLES ========================

// CVSS 3.1 representative base scores per category + severity
const CVSS_SCORES = {
  RCE:              { critical: 9.8, high: 8.1, medium: 7.3, low: 5.5, informational: 0.0 },
  AUTH_BYPASS:      { critical: 9.1, high: 8.1, medium: 6.5, low: 4.3, informational: 0.0 },
  SQLI:             { critical: 9.8, high: 8.8, medium: 7.5, low: 5.0, informational: 0.0 },
  SSRF:             { critical: 9.0, high: 7.2, medium: 5.8, low: 3.5, informational: 0.0 },
  XSS:              { critical: 8.2, high: 7.4, medium: 6.1, low: 4.3, informational: 0.0 },
  IDOR:             { critical: 8.1, high: 7.5, medium: 6.5, low: 4.3, informational: 0.0 },
  CSRF:             { critical: 8.0, high: 7.1, medium: 6.5, low: 4.3, informational: 0.0 },
  OPEN_REDIRECT:    { critical: 6.1, high: 5.4, medium: 4.3, low: 3.1, informational: 0.0 },
  INFO_DISCLOSURE:  { critical: 7.5, high: 6.5, medium: 5.3, low: 3.7, informational: 0.0 },
  OTHER:            { critical: 7.0, high: 6.0, medium: 5.0, low: 3.0, informational: 0.0 },
};

const CWE_IDS = {
  XSS:             "CWE-79",
  SQLI:            "CWE-89",
  SSRF:            "CWE-918",
  IDOR:            "CWE-639",
  RCE:             "CWE-78",
  CSRF:            "CWE-352",
  OPEN_REDIRECT:   "CWE-601",
  INFO_DISCLOSURE: "CWE-200",
  AUTH_BYPASS:     "CWE-287",
  OTHER:           "CWE-693",
};

const CWE_URLS = {
  XSS:             "https://cwe.mitre.org/data/definitions/79.html",
  SQLI:            "https://cwe.mitre.org/data/definitions/89.html",
  SSRF:            "https://cwe.mitre.org/data/definitions/918.html",
  IDOR:            "https://cwe.mitre.org/data/definitions/639.html",
  RCE:             "https://cwe.mitre.org/data/definitions/78.html",
  CSRF:            "https://cwe.mitre.org/data/definitions/352.html",
  OPEN_REDIRECT:   "https://cwe.mitre.org/data/definitions/601.html",
  INFO_DISCLOSURE: "https://cwe.mitre.org/data/definitions/200.html",
  AUTH_BYPASS:     "https://cwe.mitre.org/data/definitions/287.html",
  OTHER:           "https://cwe.mitre.org/data/definitions/693.html",
};

const OWASP_URLS = {
  XSS:             "https://owasp.org/www-community/attacks/xss/",
  SQLI:            "https://owasp.org/www-community/attacks/SQL_Injection",
  SSRF:            "https://owasp.org/www-community/attacks/Server_Side_Request_Forgery",
  IDOR:            "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References",
  RCE:             "https://owasp.org/www-community/attacks/Code_Injection",
  CSRF:            "https://owasp.org/www-community/attacks/csrf",
  OPEN_REDIRECT:   "https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html",
  INFO_DISCLOSURE: "https://owasp.org/www-project-web-security-testing-guide/",
  AUTH_BYPASS:     "https://owasp.org/www-project-top-ten/2017/A2_2017-Broken_Authentication",
  OTHER:           "https://owasp.org/www-project-top-ten/",
};

const BUSINESS_IMPACTS = {
  XSS:
    "An attacker can hijack user sessions, steal credentials, deface the application, redirect users to phishing pages, or deliver malware — all executed silently in the victim's browser.",
  SQLI:
    "An attacker can extract the entire database including user credentials and PII, bypass authentication, modify or delete records, and in some configurations execute OS-level commands.",
  SSRF:
    "An attacker can make the server issue requests to internal services, cloud metadata endpoints (e.g. AWS IMDSv1 at 169.254.169.254), or other backend systems — enabling credential theft and lateral movement.",
  IDOR:
    "An attacker can access, modify, or delete data belonging to other users by manipulating object identifiers — leading to mass data exposure and privilege escalation without any other vulnerability.",
  RCE:
    "An attacker gains the ability to execute arbitrary OS commands on the server, enabling full system compromise, data exfiltration, lateral movement, and ransomware deployment.",
  CSRF:
    "An attacker can trick authenticated users into performing unintended state-changing actions (e.g. changing email address, transferring funds, deleting accounts) by embedding forged requests in malicious pages.",
  OPEN_REDIRECT:
    "An attacker can redirect users to phishing or malware-serving pages under the trusted domain name, bypassing browser security warnings and facilitating credential theft.",
  INFO_DISCLOSURE:
    "Sensitive configuration, source code, credentials, or internal paths are exposed to unauthenticated attackers, providing a significant foothold for further exploitation.",
  AUTH_BYPASS:
    "An attacker can gain unauthorized access to protected resources or admin functionality without valid credentials, leading to full account or system takeover.",
  OTHER:
    "This misconfiguration or vulnerability weakens the application's security posture and could be chained with other issues to facilitate further attacks.",
};

// ======================== HELPER FUNCTIONS ========================

function computeCVSS(category, severity) {
  const cat = (category || "OTHER").toUpperCase().replace(/\s+/g, "_");
  const sev = (severity || "medium").toLowerCase();
  const row = CVSS_SCORES[cat] || CVSS_SCORES.OTHER;
  return row[sev] ?? row.medium ?? 5.0;
}

function getCWE(category) {
  const cat = (category || "OTHER").toUpperCase().replace(/\s+/g, "_");
  return CWE_IDS[cat] || CWE_IDS.OTHER;
}

function getReferences(category) {
  const cat = (category || "OTHER").toUpperCase().replace(/\s+/g, "_");
  return [
    { label: getCWE(category), url: CWE_URLS[cat] || CWE_URLS.OTHER },
    { label: "OWASP Reference", url: OWASP_URLS[cat] || OWASP_URLS.OTHER },
  ];
}

function getBusinessImpact(category) {
  const cat = (category || "OTHER").toUpperCase().replace(/\s+/g, "_");
  return BUSINESS_IMPACTS[cat] || BUSINESS_IMPACTS.OTHER;
}

function buildReproductionSteps(finding, target) {
  const url = finding.url || target;
  const method = finding.method || "GET";
  const payload = finding.payload || "N/A";
  const evidence = finding.evidence || "Observe the response for signs of vulnerability.";

  return [
    `Navigate to the target URL: ${url}`,
    `Send a ${method} request to the affected endpoint.`,
    `Inject the following payload into the vulnerable parameter:\n   ${payload}`,
    `Observe the HTTP response carefully.`,
    `Confirm the vulnerability via this evidence:\n   ${evidence}`,
  ];
}

// Deduplicate findings by (category + URL path + payload prefix).
// Keeps the first occurrence for each fingerprint.
function deduplicateFindings(findings) {
  const seen = new Map();
  const result = [];
  for (const f of findings) {
    let urlPath = f.url || "";
    try { urlPath = new URL(f.url).pathname; } catch {}
    const key = `${(f.category || "").toUpperCase()}::${urlPath}::${(f.payload || "").slice(0, 40).toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, true);
      result.push(f);
    }
  }
  return result;
}

// Escape markdown special characters in user-controlled strings.
function mdEscape(str) {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\|/g, "\\|")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Validate severity — clamp unknown values to "informational"
function normSev(severity) {
  const valid = ["critical", "high", "medium", "low", "informational", "info"];
  const s = (severity || "").toLowerCase();
  return valid.includes(s) ? s : "informational";
}

// ======================== PDF GENERATION ========================

export function generatePDF(scanResult) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const W = doc.page.width;   // 595.28
      const H = doc.page.height;  // 841.89
      const M = 50;               // margin

      const target = scanResult.url || "Unknown Target";
      const date = new Date().toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      });

      const predictions = scanResult.predictions || [];
      const overallSev = normSev(scanResult.severityPrediction?.name);
      const verifier = scanResult.activeScan?.aiModels?.verifier || "hacksentinel-8b";
      const payloadGen = scanResult.activeScan?.aiModels?.payload_generator || "llama3";
      const rawFindings = scanResult.activeScan?.findings || [];
      const findings = deduplicateFindings(rawFindings);
      const confirmed = findings.filter((f) => f.status === "CONFIRMED").length;

      // ─── Design tokens — match project homepage (index.css) ───
      const C_BG_DARK  = "#0f172a"; // sidebar-start / darkest slate
      const C_ACCENT   = "#06b6d4"; // --primary teal/cyan
      const C_WHITE    = "#ffffff";
      const C_SLATE    = "#94a3b8"; // --text-light
      const C_BODY     = "#1e293b"; // --secondary
      const C_TEXT     = "#334155"; // --text-secondary
      const C_MUTED    = "#64748b"; // --text-muted
      const C_LIGHT_BG = "#f8fafc"; // --bg-light
      const C_BORDER   = "#e2e8f0"; // --border-default

      const TF  = "Times-Roman";
      const TFB = "Times-Bold";
      const TFI = "Times-Italic";

      // ─── PAGE 1: COVER ───
      doc.rect(0, 0, W, H).fill(C_BG_DARK);
      // Teal top accent bar
      doc.rect(0, 0, W, 5).fill(C_ACCENT);

      // Logo
      const logoPath = "E:\\FYP\\PROJECT Documents\\hacksentinel_logo.png";
      try {
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, M, 26, { height: 36 });
        }
      } catch (e) { /* ignore if missing */ }

      // Brand name top-right
      doc.font(TF).fontSize(10).fillColor(C_ACCENT)
        .text("HACKSENTINEL SECURITY", M, 36, { align: "right", width: W - M * 2 });

      // Main title block — use fixed Y positions throughout the cover page
      // so that a long URL cannot push the risk box out of place
      const titleY = 215;
      doc.font(TFB).fontSize(36).fillColor(C_WHITE)
        .text("Vulnerability Assessment", M, titleY, { align: "center", width: W - M * 2 });
      doc.font(TFB).fontSize(36).fillColor(C_ACCENT)
        .text("Report", M, titleY + 46, { align: "center", width: W - M * 2 });
      doc.font(TF).fontSize(13).fillColor(C_SLATE)
        .text("Security Analysis & AI-Assisted Verification", M, titleY + 94, { align: "center", width: W - M * 2 });

      // Teal divider
      const divY = titleY + 124;
      doc.rect((W - 220) / 2, divY, 220, 1).fill(C_ACCENT);

      // Target and date — fixed absolute positions (no `continued` to avoid drift)
      const infoY = divY + 26;
      doc.font(TF).fontSize(8).fillColor(C_SLATE)
        .text("TARGET ASSET", M, infoY, { align: "center", width: W - M * 2, characterSpacing: 1.5 });
      // Truncate long URLs so they never push content below the risk box
      const displayTarget = target.length > 68 ? target.substring(0, 65) + "..." : target;
      doc.font(TFB).fontSize(12).fillColor(C_WHITE)
        .text(displayTarget, M, infoY + 14, { align: "center", width: W - M * 2 });

      doc.font(TF).fontSize(8).fillColor(C_SLATE)
        .text("ASSESSMENT DATE", M, infoY + 42, { align: "center", width: W - M * 2, characterSpacing: 1.5 });
      doc.font(TF).fontSize(12).fillColor(C_WHITE)
        .text(date, M, infoY + 56, { align: "center", width: W - M * 2 });

      // Overall Risk box — fixed absolute position, never shifts
      const boxW = 240;
      const boxH = 48;
      const boxX = (W - boxW) / 2;
      const boxY = infoY + 96;
      const sevColor = SEVERITY_COLORS[overallSev] || "#64748b";
      doc.rect(boxX, boxY, boxW, boxH).fill(sevColor);
      doc.font(TFB).fontSize(15).fillColor(C_WHITE)
        .text(`OVERALL RISK: ${overallSev.toUpperCase()}`, boxX, boxY + 16, { align: "center", width: boxW });

      // Confidential footer
      doc.font(TF).fontSize(8).fillColor("#475569")
        .text("HACKSENTINEL  ·  STRICTLY CONFIDENTIAL  ·  AUTHORIZED PERSONNEL ONLY", M, H - 44, { align: "center", width: W - M * 2 });

      // ─── PAGE 2: EXECUTIVE SUMMARY + METHODOLOGY ───
      doc.addPage();
      sectionHeader(doc, "1. Executive Summary");

      doc.font(TF).fontSize(10).fillColor(C_TEXT)
        .text(
          `This report presents the findings of a security assessment carried out against ${target} on ${date}. ` +
          `The assessment combined passive reconnaissance with AI-driven active testing to identify exploitable weaknesses. ` +
          `In total, ${findings.length} potential vulnerabilities were identified, of which ${confirmed} were confirmed through active payload verification.`,
          { align: "justify" }
        );
      doc.moveDown(1);

      // Summary table
      const summaryItems = [
        ["Target URL",         target],
        ["Assessment Date",    date],
        ["Overall Risk",       overallSev.toUpperCase()],
        ["Scan Type",          "AI-Augmented Active Scan"],
        ["AI Models",          `${payloadGen} + ${verifier}`],
        ["Total Findings",     findings.length.toString()],
        ["Confirmed",          confirmed.toString()],
      ];

      summaryItems.forEach(([label, value]) => {
        const rowY = doc.y;
        doc.rect(M, rowY, 140, 20).fill(C_LIGHT_BG);
        doc.strokeColor(C_BORDER).lineWidth(0.5).rect(M, rowY, W - M * 2, 20).stroke();
        doc.strokeColor(C_BORDER).moveTo(M + 140, rowY).lineTo(M + 140, rowY + 20).stroke();
        doc.font(TFB).fontSize(9).fillColor(C_MUTED).text(label, M + 6, rowY + 6);
        doc.font(TF).fontSize(9).fillColor(C_BODY).text(value, M + 148, rowY + 6, { width: W - M * 2 - 154, ellipsis: true });
        doc.y = rowY + 22;
      });

      doc.moveDown(1.5);
      sectionHeader(doc, "2. Assessment Methodology");
      doc.font(TF).fontSize(10).fillColor(C_TEXT)
        .text(
          "The assessment was carried out in three phases. The first phase was passive reconnaissance — collecting server banners, " +
          "HTTP response headers, and technology fingerprints without sending any intrusive traffic. " +
          "In the second phase, our AI prediction engine analysed the collected intelligence and identified likely attack vectors " +
          "based on patterns from historical vulnerability data. " +
          "The third phase involved controlled active testing: purpose-built proof-of-concept payloads were sent to the target " +
          "and the responses were verified by a locally-hosted large language model to confirm exploitability.",
          { align: "justify" }
        );
      doc.moveDown(1.5);

      // ─── PASSIVE RECON (continues on same page if space allows) ───
      sectionHeader(doc, "3. Passive Reconnaissance");

      const techStack = scanResult.passiveScan?.techStack || [];
      const missingHeaders = scanResult.passiveScan?.missingHeaders || [];
      const serverInfo = scanResult.passiveScan?.serverInfo;

      if (techStack.length === 0 && missingHeaders.length === 0 && !serverInfo) {
        doc.font(TFI).fontSize(10).fillColor(C_MUTED)
          .text("No passive scan data was recorded for this target.");
        doc.moveDown(0.5);
      } else {
        if (techStack.length > 0) {
          doc.font(TFB).fontSize(10).fillColor(C_BODY).text("Detected Technology Stack:");
          doc.font(TF).fontSize(10).fillColor(C_TEXT).text(techStack.join(", "), { indent: 12 });
          doc.moveDown(0.5);
        }
        if (serverInfo) {
          doc.font(TFB).fontSize(10).fillColor(C_BODY).text("Server Information:");
          doc.font(TF).fontSize(10).fillColor(C_TEXT).text(serverInfo, { indent: 12 });
          doc.moveDown(0.5);
        }
        if (missingHeaders.length > 0) {
          doc.font(TFB).fontSize(10).fillColor(C_BODY).text(`Missing Security Headers (${missingHeaders.length}):`);
          missingHeaders.forEach((h) =>
            doc.font(TF).fontSize(9).fillColor("#dc2626").text(`  •  ${h}`, { indent: 12 })
          );
          doc.moveDown(0.5);
        }
      }

      if (predictions.length > 0) {
        doc.moveDown(0.5);
        sectionHeader(doc, "AI Vulnerability Predictions");
        doc.font(TF).fontSize(10).fillColor(C_TEXT)
          .text(
            "Based on passive scan data and trained classification models, the following vulnerability classes " +
            "were flagged as likely candidates for this target:"
          );
        doc.moveDown(0.5);
        predictions.filter((p) => p.confidence > 0.01).forEach((p) => {
          const conf = (p.confidence * 100).toFixed(1);
          const riskColor = SEVERITY_COLORS_RGB[normSev(p.risk_level)] || [100, 116, 139];
          doc.font(TFB).fontSize(10).fillColor(riskColor).text(`${p.category}`, { continued: true });
          doc.font(TF).fillColor(C_MUTED).text(`  —  ${conf}% confidence  [${(p.risk_level || "info").toUpperCase()}]`);
          if (p.reasons?.length > 0) {
            p.reasons.forEach((r) =>
              doc.fontSize(9).fillColor(C_MUTED).text(`    •  ${r}`, { indent: 12 })
            );
          }
          doc.moveDown(0.3);
        });
      }

        // ─── ACTIVE SCAN FINDINGS ───
        if (findings.length > 0) {
          // Always start findings on a new page unless we are already at the top
          if (doc.y > 100) doc.addPage();
          sectionHeader(doc, "4. Vulnerability Findings");

        findings.forEach((f, idx) => {
          // Estimate space needed: ~200pt minimum per finding
          if (doc.y > 640) doc.addPage();

          const sev = normSev(f.severity);
          const cvss = computeCVSS(f.category, sev);
          const cwe = getCWE(f.category);
          const refs = getReferences(f.category);
          const impact = getBusinessImpact(f.category);
          const steps = buildReproductionSteps(f, target);

          // Finding header bar
          const fhY = doc.y;
          doc.rect(M, fhY, W - M * 2, 26).fill(C_BG_DARK);
          doc.font(TFB).fontSize(12).fillColor(C_WHITE)
            .text(`#${idx + 1}  ${f.category}`, M + 8, fhY + 7, { width: W - M * 2 - 80 });
          // Severity badge
          const badgeX = W - M - 68;
          doc.rect(badgeX, fhY + 5, 60, 16).fill(SEVERITY_COLORS[sev] || "#64748b");
          doc.font(TFB).fontSize(8).fillColor(C_WHITE)
            .text(sev.toUpperCase(), badgeX, fhY + 9, { width: 60, align: "center" });
          // Meta line
          doc.x = M; // Reset X to left margin
          doc.font(TF).fontSize(9).fillColor(C_MUTED)
            .text(`ID: HS-2026-${idx.toString().padStart(3, "0")}  ·  ${cwe}  ·  CVSS ${cvss.toFixed(1)}  ·  ${f.url || target}`, M, doc.y);
          doc.moveDown(0.6);

          // Overview
          doc.font(TFB).fontSize(10).fillColor(C_BODY).text("Overview", M);
          const desc = f.description ||
            `During the assessment, the target endpoint was found to accept input that could enable a ${f.category.toLowerCase()} attack. ` +
            `This was identified at ${f.url || target} and warrants immediate attention.`;
          doc.font(TF).fontSize(10).fillColor(C_TEXT).text(desc, M + 10, doc.y, { align: "justify", width: W - M * 2 - 10 });
          doc.moveDown(0.5);

          // Risk & Business Impact
          doc.font(TFB).fontSize(10).fillColor(C_BODY).text("Risk & Business Impact", M);
          doc.font(TF).fontSize(10).fillColor(C_TEXT).text(impact, M, doc.y, { align: "justify" });
          doc.moveDown(0.5);

          // Steps to Reproduce
          doc.font(TFB).fontSize(10).fillColor(C_BODY).text("Steps to Reproduce", M);
          steps.forEach((step, i) => {
            doc.font(TF).fontSize(10).fillColor(C_TEXT).text(`${i + 1}.  ${step}`, M + 10, doc.y, { width: W - M * 2 - 10 });
          });
          doc.moveDown(0.5);

          // Payload / Evidence box
          if (f.payload || f.evidence) {
            if (doc.y > 700) doc.addPage();
            const ebY = doc.y;
            const ebLines = (f.payload ? 1 : 0) + (f.evidence ? 1 : 0);
            const ebH = 18 + ebLines * 20;
            doc.rect(M, ebY, W - M * 2, ebH).fill(C_BG_DARK);
            let lineY = ebY + 8;
            if (f.payload) {
              doc.font("Courier-Bold").fontSize(8).fillColor(C_ACCENT).text("PAYLOAD:", M + 10, lineY);
              doc.font("Courier").fontSize(8).fillColor(C_WHITE)
                .text(String(f.payload).substring(0, 120), M + 66, lineY, { width: W - M * 2 - 80 });
              lineY += 18;
            }
            if (f.evidence) {
              doc.font("Courier-Bold").fontSize(8).fillColor(C_ACCENT).text("EVIDENCE:", M + 10, lineY);
              doc.font("Courier").fontSize(8).fillColor(C_SLATE)
                .text(String(f.evidence).substring(0, 160) + "...", M + 68, lineY, { width: W - M * 2 - 82 });
            }
            doc.y = ebY + ebH + 8;
          }

          // Remediation box
          if (doc.y > 730) doc.addPage();
          const remY = doc.y;
          doc.rect(M, remY, W - M * 2, 44).fill("#f0fdf4");
          doc.font(TFB).fontSize(9).fillColor("#166534").text("RECOMMENDED FIX", M + 10, remY + 8);
          doc.font(TF).fontSize(9).fillColor("#15803d")
            .text(
              f.remediation || `Apply input validation and output encoding controls to prevent ${f.category} exploitation.`,
              M + 10, remY + 20, { width: W - M * 2 - 20 }
            );
          doc.y = remY + 48;

          // References
          doc.font(TFB).fontSize(9).fillColor(C_MUTED).text("References:", M);
          refs.forEach((r) => {
            doc.font(TF).fontSize(9).fillColor("#3b82f6").text(`  •  ${r.label}: ${r.url}`, M + 10, doc.y, { width: W - M * 2 - 10 });
          });

          doc.moveDown(1.5);
          doc.strokeColor(C_BORDER).lineWidth(0.5).moveTo(M, doc.y).lineTo(W - M, doc.y).stroke();
          doc.moveDown(1.5);
        });
      }

      // ─── REMEDIATION ROADMAP ───
      if (findings.length > 0) {
        if (doc.y > 560) doc.addPage();
        sectionHeader(doc, "5. Remediation Roadmap");
        doc.font(TF).fontSize(10).fillColor(C_TEXT)
          .text(
            "The following actions are recommended, grouped by vulnerability class. " +
            "Items should be prioritised based on their CVSS score and the sensitivity of the affected data."
          );
        doc.moveDown(0.8);

        const grouped = {};
        findings.forEach((f) => {
          if (!grouped[f.category]) grouped[f.category] = [];
          grouped[f.category].push(f);
        });

        Object.entries(grouped).forEach(([category, items]) => {
          if (doc.y > 700) doc.addPage();
          doc.font(TFB).fontSize(11).fillColor(C_BODY).text(category);
          items.forEach((f) => {
            if (f.remediation) {
              if (doc.y > 750) doc.addPage();
              doc.font(TF).fontSize(9).fillColor("#16a34a")
                .text(`  •  ${f.remediation}`, M + 10, doc.y, { width: W - M * 2 - 10 });
            }
          });
          doc.moveDown(0.5);
        });
      }

      // ─── PAGE FOOTERS ───
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.font(TF).fontSize(8).fillColor(C_MUTED)
          .text(
            `HackSentinel Security Report  ·  Confidential  ·  Page ${i + 1} of ${pages.count}`,
            M, H - 36, { align: "center", width: W - M * 2 }
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function sectionHeader(doc, title) {
  if (doc.y > 730) doc.addPage();
  const M = 50;
  doc.x = M; // Always start at left margin
  doc.font("Times-Bold").fontSize(16).fillColor("#0f172a").text(title, M, doc.y);
  doc.moveDown(0.1);
  doc.strokeColor("#06b6d4").lineWidth(2.5).moveTo(M, doc.y).lineTo(M + Math.min(title.length * 8, 300), doc.y).stroke();
  doc.moveDown(0.7);
}

// ======================== DOCX GENERATION ========================

export async function generateDOCX(scanResult) {
  const target = scanResult.url || "Unknown Target";
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const rawFindings = scanResult.activeScan?.findings || [];
  const findings = deduplicateFindings(rawFindings);
  const confirmed = findings.filter((f) => f.status === "CONFIRMED").length;
  const potential = findings.length - confirmed;
  const predictions = scanResult.predictions || [];
  const overallSev = normSev(scanResult.severityPrediction?.name);
  const verifier = scanResult.activeScan?.aiModels?.verifier || "hacksentinel-8b";
  const payloadGen = scanResult.activeScan?.aiModels?.payload_generator || "llama3";

  const summaryRows = [
    ["Target Domain", target],
    ["Assessment Date", date],
    ["Overall Severity", overallSev.toUpperCase()],
    ["AI Verifier", verifier],
    ["Payload Gen", payloadGen],
  ];

  const sections = [];

  // ── 1. TITLE PAGE ──
  sections.push({
    properties: { type: "nextPage" },
    children: [
      (() => {
        const logoPath = "E:\\FYP\\PROJECT Documents\\hacksentinel_logo.png";
        try {
          if (fs.existsSync(logoPath)) {
            return new Paragraph({
              children: [
                new ImageRun({
                  data: fs.readFileSync(logoPath),
                  transformation: { width: 60, height: 60 },
                }),
              ],
              alignment: AlignmentType.CENTER,
            });
          }
        } catch (e) {
          console.warn("Logo not found for DOCX, skipping image.");
        }
        return new Paragraph({ text: "HACKSENTINEL SECURITY", alignment: AlignmentType.CENTER });
      })(),
      new Paragraph({ text: "Vulnerability Assessment Report", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { before: 400 } }),
      new Paragraph({ text: "Advanced Security Analysis & AI Verification", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: "", spacing: { before: 800 } }),
      new Paragraph({ text: `Target Asset: ${target}`, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Assessment Date: ${date}`, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: "", spacing: { before: 1200 } }),
      new Paragraph({
        children: [
          new TextRun({
            text: `OVERALL RISK: ${overallSev.toUpperCase()}`,
            bold: true,
            color: SEVERITY_COLORS[overallSev]?.replace("#", "") || "64748b",
            size: 32,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: "", spacing: { before: 2000 } }),
      new Paragraph({ text: "CONFIDENTIAL — HACKSENTINEL ADVISORY", alignment: AlignmentType.CENTER }),
    ],
  });

  // ── 2. EXECUTIVE SUMMARY ──
  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(new Paragraph({ text: "1. Executive Summary", heading: HeadingLevel.HEADING_1 }));
  sections.push(
      new Paragraph({
        text: `This assessment was conducted using the HackSentinel AI Pipeline. Our analysis identified ${findings.length} total potential security weaknesses, of which ${confirmed} have been technically confirmed via active payload verification.`,
      })
  );
  sections.push(new Paragraph({ text: "", spacing: { before: 400 } }));
  sections.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: "Target Domain", bold: true })] }), new TableCell({ children: [new Paragraph(target)] })] }),
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: "Assessment Type", bold: true })] }), new TableCell({ children: [new Paragraph("AI-Augmented DAST")] })] }),
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: "Verified Findings", bold: true })] }), new TableCell({ children: [new Paragraph(confirmed.toString())] })] }),
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: "Overall Risk Rating", bold: true })] }), new TableCell({ children: [new Paragraph(overallSev.toUpperCase())] })] }),
    ],
  }));

  sections.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: summaryRows.map(([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })],
              width: { size: 30, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: value, size: 20 })] })],
              width: { size: 70, type: WidthType.PERCENTAGE },
            }),
          ],
        })
      ),
    })
  );

  // Passive Scan
  sections.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Passive Scan Results", color: "7c3aed" })], spacing: { before: 400 } })
  );

  const techStack = scanResult.passiveScan?.techStack || [];
  if (techStack.length > 0) {
    sections.push(
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Detected Technologies")] }),
      new Paragraph({ children: [new TextRun({ text: techStack.join(", "), size: 20 })] })
    );
  }

  const missingHeaders = scanResult.passiveScan?.missingHeaders || [];
  if (missingHeaders.length > 0) {
    sections.push(
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(`Missing Security Headers (${missingHeaders.length})`)] })
    );
    missingHeaders.forEach((h) => {
      sections.push(new Paragraph({ children: [new TextRun({ text: `- ${h}`, color: "dc2626", size: 20 })] }));
    });
  }

  // AI Predictions
  if (predictions.length > 0) {
    sections.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "AI Vulnerability Predictions", color: "7c3aed" })], spacing: { before: 400 } })
    );
    predictions.filter((p) => p.confidence > 0.01).forEach((p) => {
      const conf = (p.confidence * 100).toFixed(1);
      const sev = normSev(p.risk_level);
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${p.category} — ${conf}% confidence`, bold: true, size: 22, color: SEVERITY_COLORS[sev]?.replace("#", "") || "64748b" }),
            new TextRun({ text: ` [${sev.toUpperCase()}]`, size: 20, color: "64748b" }),
          ],
        })
      );
      if (p.reasons?.length > 0) {
        p.reasons.forEach((r) => {
          sections.push(new Paragraph({ children: [new TextRun({ text: `  - ${r}`, size: 18, color: "64748b" })] }));
        });
      }
    });
  }

  // ── 3. DETAILED FINDINGS ──
  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(new Paragraph({ text: "2. Detailed Vulnerability Findings", heading: HeadingLevel.HEADING_1, spacing: { before: 400 } }));

  if (findings.length === 0) {
    sections.push(
      new Paragraph({ text: "No verified vulnerabilities were identified during this assessment cycle." })
    );
  } else {
    findings.forEach((f, idx) => {
      const sev = normSev(f.severity);
      const cvss = computeCVSS(f.category, sev);
      const cwe = getCWE(f.category);
      const impact = getBusinessImpact(f.category);
      const steps = buildReproductionSteps(f, target);

      sections.push(
        new Paragraph({ text: `${idx + 1}. ${f.category} - ${sev.toUpperCase()}`, heading: HeadingLevel.HEADING_2, spacing: { before: 400 } }),
        new Paragraph({
          children: [
            new TextRun({ text: `Vulnerability ID: HS-2026-${idx.toString().padStart(3, '0')} | CWE: ${cwe} | CVSS: ${cvss.toFixed(1)}`, color: "64748b", size: 18 }),
          ],
        }),
        new Paragraph({ text: "Description:", bold: true, spacing: { before: 200 } }),
        new Paragraph({ text: f.description || `The application was found susceptible to ${f.category} attacks.`, alignment: AlignmentType.JUSTIFY }),
        new Paragraph({ text: "Business Risk & Impact:", bold: true, spacing: { before: 200 } }),
        new Paragraph({ text: impact, color: "dc2626" }),
        new Paragraph({ text: "Technical Proof of Concept (PoC):", bold: true, spacing: { before: 200 } }),
        ...steps.map((step, i) => new Paragraph({ text: `${i + 1}. ${step}`, indent: { left: 720 } })),
        new Paragraph({ text: "Suggested Remediation:", bold: true, spacing: { before: 200 } }),
        new Paragraph({ text: f.remediation || "Implement secure coding practices to mitigate this risk.", color: "16a34a" }),
        new Paragraph({ text: "------------------------------------------------------------", alignment: AlignmentType.CENTER, spacing: { before: 400 } })
      );
    });
  }

  // ── 4. REMEDIATION ROADMAP ──
  if (findings.length > 0) {
    sections.push(
      new Paragraph({ text: "3. Remediation Roadmap", heading: HeadingLevel.HEADING_1, spacing: { before: 400 } })
    );

    const grouped = {};
    findings.forEach((f) => {
      if (!grouped[f.category]) grouped[f.category] = [];
      grouped[f.category].push(f);
    });

    Object.entries(grouped).forEach(([category, items]) => {
      sections.push(
        new Paragraph({ text: `${category}:`, heading: HeadingLevel.HEADING_2 }),
        ...items.map(f => new Paragraph({ text: `• ${f.remediation}`, color: "16a34a", indent: { left: 360 } }))
      );
    });
  }

  // Footer
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: "Confidential — Generated by HackSentinel", size: 16, color: "94a3b8" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
    })
  );

  const docx = new Document({ sections: [{ children: sections }] });
  return Packer.toBuffer(docx);
}

// ======================== JSON GENERATION ========================

export function generateJSON(scanResult) {
  const rawFindings = scanResult.activeScan?.findings || [];
  const findings = deduplicateFindings(rawFindings);

  const exportData = {
    meta: {
      tool: "HackSentinel",
      version: "2.0",
      generatedAt: new Date().toISOString(),
      target: scanResult.url,
    },
    passiveScan: {
      techStack: scanResult.passiveScan?.techStack || [],
      missingHeaders: scanResult.passiveScan?.missingHeaders || [],
      serverInfo: scanResult.passiveScan?.serverInfo || null,
      statusCode: scanResult.passiveScan?.statusCode || null,
    },
    predictions: (scanResult.predictions || []).map((p) => ({
      category: p.category,
      confidence: p.confidence,
      riskLevel: p.risk_level,
      reasons: p.reasons || [],
    })),
    severityPrediction: scanResult.severityPrediction || null,
    activeScan: {
      findings: findings.map((f) => {
        const sev = normSev(f.severity);
        return {
          category: f.category,
          severity: sev,
          cvss_score: computeCVSS(f.category, sev),
          cwe_id: getCWE(f.category),
          confidence: f.confidence,
          status: f.status,
          payload: f.payload,
          url: f.url,
          method: f.method,
          evidence: f.evidence,
          description: f.description,
          business_impact: getBusinessImpact(f.category),
          reproduction_steps: buildReproductionSteps(f, scanResult.url),
          remediation: f.remediation,
          references: getReferences(f.category),
          ai_verified_by: f.ai_verified_by || null,
        };
      }),
      summary: scanResult.activeScan?.summary || null,
      aiModels: scanResult.activeScan?.aiModels || null,
    },
  };

  return Buffer.from(JSON.stringify(exportData, null, 2));
}

// ======================== MARKDOWN GENERATION ========================

export function generateMarkdown(scanResult) {
  const target = scanResult.url || "Unknown Target";
  const date = new Date().toISOString().split("T")[0];
  const overallSev = normSev(scanResult.severityPrediction?.name).toUpperCase();
  const mdVerifier = scanResult.activeScan?.aiModels?.verifier || "hacksentinel-8b";
  const mdPayloadGen = scanResult.activeScan?.aiModels?.payload_generator || "llama3";
  const mdOllamaActive = scanResult.activeScan?.aiModels?.ollama_available !== false;

  const rawFindings = scanResult.activeScan?.findings || [];
  const findings = deduplicateFindings(rawFindings);
  let md = `# HACKSENTINEL | SECURITY ADVISORY\n\n`;
  md += `> **DISCLAIMER:** This report contains sensitive security information. Access is restricted to authorized personnel.\n\n`;
  md += `## 🛡️ Report Information\n`;
  md += `| Attribute | Details |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **Target Asset** | ${mdEscape(target)} |\n`;
  md += `| **Assessment Date** | ${date} |\n`;
  md += `| **Risk Rating** | **${overallSev}** |\n`;
  md += `| **Verified by** | ${mdVerifier} |\n\n`;

  md += `## 1. Executive Summary\n`;
  md += `The HackSentinel AI engine has completed an automated security assessment. Below are the confirmed findings verified using specialized Large Language Models.\n\n`;

  if (findings.length > 0) {
    md += `## 2. Technical Findings\n\n`;
    findings.forEach((f, idx) => {
      const sev = normSev(f.severity);
      const cvss = computeCVSS(f.category, sev);
      const impact = getBusinessImpact(f.category);
      const steps = buildReproductionSteps(f, target);

      md += `### [Finding #${idx + 1}] ${mdEscape(f.category)}\n`;
      md += `- **Severity:** ${sev.toUpperCase()} (CVSS: ${cvss.toFixed(1)})\n`;
      md += `- **Location:** \`${mdEscape(f.url || target)}\`\n`;
      md += `- **Method:** \`${mdEscape(f.method || "GET")}\`\n\n`;
      
      md += `#### Description\n${mdEscape(f.description || "Found susceptibility to " + f.category)}\n\n`;

      md += `#### Proof of Concept (Steps to Reproduce)\n`;
      steps.forEach((s, i) => { md += `${i + 1}. ${mdEscape(s)}\n`; });
      
      if (f.payload) md += `\n**Verified Payload:**\n\`\`\`bash\n${f.payload}\n\`\`\`\n`;
      if (f.evidence) md += `\n**Technical Evidence:**\n\`\`\`text\n${f.evidence.substring(0, 300)}...\n\`\`\`\n\n`;

      md += `#### Impact & Risk\n${impact}\n\n`;
      md += `#### Remediation Guidance\n✅ ${mdEscape(f.remediation)}\n\n`;
      md += `---\n\n`;
    });
  }

  return Buffer.from(md);
}

// ======================== HACKERONE FORMAT ========================

export function generateHackerOne(scanResult) {
  const target = scanResult.url || "Unknown Target";
  const date = new Date().toISOString().split("T")[0];

  const rawFindings = scanResult.activeScan?.findings || [];
  const findings = deduplicateFindings(rawFindings);
  const confirmed = findings.filter((f) => f.status === "CONFIRMED");

  // Only report confirmed findings on HackerOne
  const reportable = confirmed.length > 0 ? confirmed : findings;

  let md = `# HACKSENTINEL | HACKERONE DISCLOSURE REPORT\n\n`;
  md += `## 📄 Summary\n`;
  md += `${mdEscape(target)} was assessed for common web vulnerabilities. Multiple confirmed findings were identified.\n\n`;

  md += `## 🛠️ Technical Details\n\n`;
  reportable.forEach((f, idx) => {
    const sev = normSev(f.severity);
    const cvss = computeCVSS(f.category, sev);
    const steps = buildReproductionSteps(f, target);

    md += `### ${mdEscape(f.category)} at ${mdEscape(f.url || target)}\n`;
    md += `- **Severity:** ${sev.toUpperCase()}\n`;
    md += `- **Weakness (CWE):** ${getCWE(f.category)}\n\n`;

    md += `#### Description\n${mdEscape(f.description)}\n\n`;

    md += `#### Steps to Reproduce\n`;
    steps.forEach((s, i) => { md += `${i + 1}. ${mdEscape(s)}\n`; });
    
    if (f.payload) md += `\n**Verified Payload:**\n\`\`\`bash\n${f.payload}\n\`\`\`\n`;

    md += `\n#### Impact\n${getBusinessImpact(f.category)}\n\n`;
    md += `#### Recommended Fix\n${mdEscape(f.remediation)}\n\n`;
    md += `---\n\n`;
  });

  return Buffer.from(md);
}

// ======================== BUGCROWD FORMAT ========================

export function generateBugcrowd(scanResult) {
  const target = scanResult.url || "Unknown Target";
  const rawFindings = scanResult.activeScan?.findings || [];
  const findings = deduplicateFindings(rawFindings);

  let md = `# BUGCROWD VULNERABILITY SUBMISSION\n\n`;
  md += `## [Executive Summary]\n`;
  md += `Automated security assessment of ${mdEscape(target)} using HackSentinel AI Engine.\n\n`;

  findings.forEach((f, idx) => {
    const sev = normSev(f.severity);
    const impact = getBusinessImpact(f.category);
    const steps = buildReproductionSteps(f, target);

    md += `## [Finding #${idx + 1}] ${mdEscape(f.category)}\n`;
    md += `### [Vulnerability Description]\n${mdEscape(f.description || "Found susceptibility to " + f.category)}\n\n`;
    md += `### [Steps to Reproduce]\n`;
    steps.forEach((s, i) => { md += `${i + 1}. ${mdEscape(s)}\n`; });
    
    md += `\n### [Impact]\n${impact}\n\n`;
    md += `### [HTTP Request/Response]\n\`\`\`\n${f.evidence || "Evidence attached to original scan results."}\n\`\`\`\n\n`;
    md += `---\n\n`;
  });

  return Buffer.from(md);
}

// ======================== INTIGRITI FORMAT ========================

export function generateIntigriti(scanResult) {
  const target = scanResult.url || "Unknown Target";
  const findings = deduplicateFindings(scanResult.activeScan?.findings || []);

  let md = `# INTIGRITI SECURITY ADVISORY\n\n`;
  md += `## 1. Researcher Information\n- **Tool:** HackSentinel AI\n- **Target:** ${mdEscape(target)}\n\n`;

  findings.forEach((f, idx) => {
    const sev = normSev(f.severity);
    const cvss = computeCVSS(f.category, sev);
    const steps = buildReproductionSteps(f, target);

    md += `## 2. Report: ${mdEscape(f.category)}\n`;
    md += `- **Endpoint:** \`${mdEscape(f.url || target)}\`\n`;
    md += `- **CVSS Vector:** ${cvss.toFixed(1)} (${sev.toUpperCase()})\n\n`;
    
    md += `### Description\n${mdEscape(f.description)}\n\n`;
    md += `### Steps to reproduce\n`;
    steps.forEach((s, i) => { md += `${i + 1}. ${mdEscape(s)}\n`; });
    
    md += `\n### Impact Analysis\n${getBusinessImpact(f.category)}\n\n`;
    md += `### Recommendation\n${mdEscape(f.remediation)}\n\n`;
    md += `---\n\n`;
  });

  return Buffer.from(md);
}

// ======================== YESWEHACK FORMAT ========================

export function generateYesWeHack(scanResult) {
  const target = scanResult.url || "Unknown Target";
  const findings = deduplicateFindings(scanResult.activeScan?.findings || []);

  let md = `# YESWEHACK DISCLOSURE\n\n`;
  md += `## SCOPE: ${mdEscape(target)}\n\n`;

  findings.forEach((f, idx) => {
    const steps = buildReproductionSteps(f, target);

    md += `### VULNERABILITY: ${mdEscape(f.category)}\n`;
    md += `**DESCRIPTION:**\n${mdEscape(f.description)}\n\n`;
    
    md += `**PROOF OF CONCEPT:**\n`;
    steps.forEach((s, i) => { md += `- ${mdEscape(s)}\n`; });
    
    if (f.payload) md += `\n**PAYLOAD:** \`${f.payload}\`\n`;
    
    md += `\n**IMPACT:**\n${getBusinessImpact(f.category)}\n\n`;
    md += `**REMEDIATION:**\n${mdEscape(f.remediation)}\n\n`;
    md += `***\n\n`;
  });

  return Buffer.from(md);
}
