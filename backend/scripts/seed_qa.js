import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import QA from '../models/QA.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const initialQAs = [

    // ── GREETINGS ──────────────────────────────────────────────────────
    { question: "Hello", answer: "Hello! I'm HackSentinel's AI assistant. Ask me about scans, reports, security vulnerabilities, or your account.", keywords: ["hello", "hi", "hey", "greetings", "good morning", "good evening", "sup", "howdy"], category: "general" },
    { question: "Who are you?", answer: "I'm HackSentinel's built-in AI assistant — I can answer questions about the platform, your scans, and cybersecurity topics.", keywords: ["who are you", "what are you", "identity", "bot", "assistant", "your name"], category: "general" },
    { question: "What can you do?", answer: "I can help with starting scans, reading reports, understanding vulnerabilities, managing your account, and answering security questions.", keywords: ["what can you do", "help me", "capabilities", "features", "how can you help"], category: "general" },
    { question: "Thank you", answer: "You're welcome! Let me know if you need anything else.", keywords: ["thank you", "thanks", "appreciated", "cheers", "ty"], category: "general" },
    { question: "Goodbye", answer: "Goodbye! Stay secure.", keywords: ["bye", "goodbye", "see you", "later", "exit", "quit"], category: "general" },

    // ── WHAT IS HACKSENTINEL ───────────────────────────────────────────
    { question: "What is HackSentinel?", answer: "HackSentinel is an AI-powered web vulnerability scanner that runs passive and active scans to detect security flaws, then generates professional reports (PDF, DOCX, HackerOne format).", keywords: ["hacksentinel", "about", "what is hacksentinel", "overview", "platform"], category: "general" },
    { question: "How does HackSentinel work?", answer: "It runs two phases: Passive Scan (checks headers, configs silently) then Active AI Scan (generates contextual attack payloads and uses an LLM to verify results — eliminating false positives).", keywords: ["how does it work", "how hacksentinel works", "process", "two phases", "mechanism"], category: "general" },
    { question: "Is HackSentinel free?", answer: "Yes, there's a Free plan (5 scans/month). Professional is $49/month (unlimited scans + AI insights) and Enterprise is $199/month (team features + SLA).", keywords: ["free", "is it free", "cost", "price", "how much"], category: "subscription" },

    // ── SCANNING ──────────────────────────────────────────────────────
    { question: "How do I start a scan?", answer: "Go to Dashboard → enter the target URL → check the authorization checkbox → click Scan. Results appear in Scan History when complete.", keywords: ["start scan", "how to scan", "begin scan", "run scan", "scan a website", "scan url"], category: "scanning" },
    { question: "How long does a scan take?", answer: "Most scans complete in 5–15 minutes depending on site size and number of endpoints.", keywords: ["how long", "scan time", "duration", "minutes", "scan speed"], category: "scanning" },
    { question: "What vulnerabilities does HackSentinel detect?", answer: "SQLi, XSS, SSRF, RCE, CSRF, IDOR, Broken Access Control, Security Misconfiguration, Sensitive Data Exposure, Clickjacking, Open Redirect, and more.", keywords: ["what vulnerabilities", "detect", "types", "find", "scan for", "check for"], category: "scanning" },
    { question: "What is passive scanning?", answer: "Passive scan silently analyzes HTTP headers, server configs, SSL/TLS, tech stack, and information leakage — no attack payloads sent.", keywords: ["passive scan", "passive scanning", "phase 1", "reconnaissance", "silent"], category: "scanning" },
    { question: "What is active scanning?", answer: "Active scan fires AI-generated attack payloads against the target's inputs and uses an LLM to confirm whether each attack actually succeeded.", keywords: ["active scan", "active scanning", "phase 2", "payload", "attack"], category: "scanning" },
    { question: "Can I scan any website?", answer: "Only websites you own or have explicit written permission to test. Unauthorized scanning is illegal. Always check the authorization checkbox.", keywords: ["can i scan", "permission", "legal", "authorized", "ethical", "any website"], category: "scanning" },
    { question: "How do I view scan history?", answer: "Click 'Scan History' in the Dashboard sidebar — you'll see all past scans with dates, URLs, and vulnerability counts. Click the eye icon for full details.", keywords: ["scan history", "past scans", "previous scans", "old scans", "view scans"], category: "scanning" },
    { question: "My scan is stuck or failed", answer: "Refresh the page and check Scan History. If it shows 'failed', the target URL may be unreachable, blocking requests, or behind a WAF. Try again or contact support.", keywords: ["scan stuck", "scan failed", "scan not completing", "scan error", "scan problem"], category: "scanning" },
    { question: "Can I scan multiple websites?", answer: "Free plan: 5 scans/month. Professional and Enterprise plans: unlimited scans.", keywords: ["multiple websites", "scan limit", "how many scans", "unlimited"], category: "scanning" },
    { question: "What is a false positive?", answer: "A false positive is when a scanner reports a vulnerability that doesn't actually exist. HackSentinel uses LLM response verification to minimize false positives.", keywords: ["false positive", "false alarm", "wrong result", "inaccurate", "incorrect finding"], category: "scanning" },
    { question: "What is WAF detection?", answer: "HackSentinel detects if the target is behind a Web Application Firewall (like Cloudflare or Akamai) and notes it in the passive scan results.", keywords: ["waf", "firewall", "cloudflare", "waf detection", "web application firewall"], category: "scanning" },
    { question: "What is SSL/TLS analysis?", answer: "HackSentinel checks the target's SSL certificate expiry, supported protocols, cipher strength, and SAN domains during passive scanning.", keywords: ["ssl", "tls", "certificate", "https", "ssl analysis", "tls check"], category: "scanning" },

    // ── REPORTS ───────────────────────────────────────────────────────
    { question: "How do I download my report?", answer: "Go to the Reports tab → find your scan → click the PDF, DOCX, or HackerOne icon to download.", keywords: ["download report", "get report", "export report", "save report"], category: "reports" },
    { question: "What report formats are available?", answer: "PDF (visual summary), DOCX (editable Word), Markdown (plain text), and HackerOne format (ready for bug bounty submission).", keywords: ["report formats", "pdf", "docx", "word", "hackerone", "markdown", "formats"], category: "reports" },
    { question: "What is HackerOne format?", answer: "A structured report format used for submitting vulnerabilities to bug bounty programs on HackerOne and Bugcrowd — generated automatically by HackSentinel.", keywords: ["hackerone format", "bug bounty report", "hackerone", "bugcrowd", "submit report"], category: "reports" },
    { question: "What is CVSS severity?", answer: "CVSS scores rate vulnerability severity: Critical (9–10), High (7–8.9), Medium (4–6.9), Low (0.1–3.9). HackSentinel shows this for every finding.", keywords: ["cvss", "severity", "critical", "high severity", "medium severity", "low severity", "score"], category: "reports" },
    { question: "How do I get an AI explanation of my scan?", answer: "Copy the Scan ID from Scan History (clipboard icon) → paste it into this chat → ask me to explain it. I'll read the findings and explain them in plain language.", keywords: ["explain scan", "scan id", "explain result", "explain findings", "ai explanation", "copy id"], category: "reports" },
    { question: "Report not generating", answer: "Wait for the scan to fully complete first. If it still doesn't appear after a minute, try refreshing the Reports tab or contact support.", keywords: ["report not generating", "report missing", "no report", "report not showing"], category: "reports" },

    // ── ACCOUNT ───────────────────────────────────────────────────────
    { question: "How do I sign up?", answer: "Click 'Sign Up' on the homepage → enter your name, email, and password → verify your email → you're in.", keywords: ["sign up", "register", "create account", "new account", "how to register"], category: "account" },
    { question: "How do I log in?", answer: "Click 'Sign In' → enter your email and password. If 2FA is enabled, enter the OTP sent to your email.", keywords: ["log in", "login", "sign in", "how to login", "access account"], category: "account" },
    { question: "I forgot my password", answer: "Click 'Forgot Password' on the login page → enter your email → follow the reset link sent to your inbox.", keywords: ["forgot password", "reset password", "password reset", "lost password", "change password"], category: "account" },
    { question: "How do I enable 2FA?", answer: "Go to Settings → find '2FA Settings' → click Enable → verify with the OTP sent to your email. Future logins will require an OTP.", keywords: ["enable 2fa", "two factor", "2fa", "otp", "mfa", "two-factor authentication"], category: "account" },
    { question: "How do I disable 2FA?", answer: "Go to Settings → '2FA Settings' → click Disable → confirm with your current OTP.", keywords: ["disable 2fa", "turn off 2fa", "remove 2fa", "deactivate 2fa"], category: "account" },
    { question: "OTP not received", answer: "Check your spam/junk folder. If still missing, wait 1 minute and request a new OTP. Ensure your email is correct in Settings.", keywords: ["otp not received", "no otp", "otp not arriving", "verification code", "code not received"], category: "account" },
    { question: "How do I update my profile?", answer: "Go to Settings → update your name, email, or password → click Save.", keywords: ["update profile", "change name", "change email", "edit profile", "profile settings"], category: "account" },
    { question: "How do I delete my account?", answer: "Go to Settings → scroll to 'Danger Zone' → click Delete Account → confirm. This action is irreversible.", keywords: ["delete account", "remove account", "close account", "deactivate account"], category: "account" },
    { question: "I can't log in", answer: "Check your email/password for typos. Use 'Forgot Password' to reset. If 2FA is blocking you, check your email spam folder for the OTP.", keywords: ["cant login", "can't log in", "login failed", "login not working", "access denied"], category: "account" },

    // ── SUBSCRIPTION & BILLING ─────────────────────────────────────────
    { question: "What plans are available?", answer: "FREE ($0 — 5 scans/month), PROFESSIONAL ($49/month — unlimited scans + AI insights), ENTERPRISE ($199/month — team features, SLA, dedicated support).", keywords: ["plans", "pricing", "subscription", "tiers", "packages", "what plans"], category: "subscription" },
    { question: "How do I upgrade my plan?", answer: "Go to the Subscription tab → choose your plan → click Purchase → enter payment details. Upgrade takes effect immediately.", keywords: ["upgrade plan", "upgrade subscription", "buy plan", "get professional", "purchase plan"], category: "subscription" },
    { question: "How do I cancel my subscription?", answer: "Go to Settings → Payment Settings → Manage Subscription → Cancel. Access continues until end of your billing period.", keywords: ["cancel subscription", "cancel plan", "stop subscription", "unsubscribe"], category: "subscription" },
    { question: "What payment methods do you accept?", answer: "Visa, MasterCard, American Express, PayPal, and bank transfer for Enterprise customers.", keywords: ["payment methods", "how to pay", "card", "paypal", "bank transfer", "billing"], category: "subscription" },
    { question: "Do you offer refunds?", answer: "We offer refunds within 7 days of purchase if no scans were run. Contact support at contact@hacksentinel.com.", keywords: ["refund", "money back", "refund policy", "cancel refund"], category: "subscription" },
    { question: "Subscription not activated", answer: "If your payment succeeded but plan hasn't upgraded, wait 5 minutes and refresh. If still unresolved, email contact@hacksentinel.com with your receipt.", keywords: ["subscription not activated", "plan not upgraded", "payment not reflecting", "billing issue"], category: "subscription" },

    // ── SECURITY CONCEPTS ──────────────────────────────────────────────
    { question: "What is XSS?", answer: "Cross-Site Scripting — attackers inject malicious scripts into web pages viewed by other users. Fix: sanitize input, use CSP headers, avoid innerHTML with user data.", keywords: ["xss", "cross-site scripting", "script injection", "javascript injection"], category: "security" },
    { question: "What is SQL Injection?", answer: "Attackers insert malicious SQL into input fields to read, modify, or delete database data. Fix: use parameterized queries — never concatenate user input into SQL.", keywords: ["sql injection", "sqli", "sql", "database injection", "database attack"], category: "security" },
    { question: "What is SSRF?", answer: "Server-Side Request Forgery — attacker makes the server send requests to internal services (e.g., cloud metadata at 169.254.169.254). Fix: allowlist permitted URLs, block internal ranges.", keywords: ["ssrf", "server-side request forgery", "internal request", "metadata", "cloud metadata"], category: "security" },
    { question: "What is CSRF?", answer: "Cross-Site Request Forgery — tricks a logged-in user into submitting a malicious request. Fix: use CSRF tokens and SameSite cookie attribute.", keywords: ["csrf", "cross-site request forgery", "forged request", "xsrf"], category: "security" },
    { question: "What is RCE?", answer: "Remote Code Execution — attacker runs arbitrary commands on your server, usually via command injection or insecure deserialization. The most critical vulnerability type.", keywords: ["rce", "remote code execution", "command injection", "shell injection", "os command"], category: "security" },
    { question: "What is IDOR?", answer: "Insecure Direct Object Reference — a type of Broken Access Control where changing an ID in a URL/request gives access to another user's data.", keywords: ["idor", "insecure direct object", "object reference", "access other user"], category: "security" },
    { question: "What is Path Traversal?", answer: "Attackers use '../' sequences to escape the web root and access server files like /etc/passwd. Fix: canonicalize paths and never build file paths from raw user input.", keywords: ["path traversal", "directory traversal", "dot dot slash", "../", "file inclusion"], category: "security" },
    { question: "What is Clickjacking?", answer: "An invisible iframe overlays a legitimate page, tricking users into clicking hidden buttons. Fix: set X-Frame-Options: DENY or CSP frame-ancestors directive.", keywords: ["clickjacking", "iframe attack", "ui redress", "x-frame-options"], category: "security" },
    { question: "What is Open Redirect?", answer: "App redirects users to attacker-controlled URLs, used for phishing. Fix: validate redirect URLs against a strict allowlist.", keywords: ["open redirect", "redirect attack", "unvalidated redirect", "phishing redirect"], category: "security" },
    { question: "What is Broken Access Control?", answer: "Users can act beyond their intended permissions — e.g., access admin pages, view others' data, or elevate privileges. Fix: enforce server-side authorization on every request.", keywords: ["broken access control", "access control", "unauthorized access", "privilege escalation"], category: "security" },
    { question: "What is Security Misconfiguration?", answer: "Unchanged default credentials, open ports, verbose errors, missing headers — the most common vulnerability class. Fix: harden configs, disable unused features, audit regularly.", keywords: ["security misconfiguration", "misconfiguration", "default credentials", "default password", "exposed"], category: "security" },
    { question: "What is a CVE?", answer: "Common Vulnerabilities and Exposures — a public database of known security flaws in software. Each CVE has a unique ID (e.g., CVE-2021-44228 for Log4Shell).", keywords: ["cve", "common vulnerabilities", "known vulnerability", "cve id", "vulnerability database"], category: "security" },
    { question: "What is penetration testing?", answer: "Authorized simulated attack on a system to find vulnerabilities before real attackers do. HackSentinel automates a significant portion of this process.", keywords: ["penetration testing", "pentest", "ethical hacking", "pen test", "authorized testing"], category: "security" },
    { question: "What is a bug bounty?", answer: "A program where companies pay researchers to responsibly report security vulnerabilities. HackSentinel generates HackerOne-format reports for direct submission.", keywords: ["bug bounty", "hackerone", "bugcrowd", "responsible disclosure", "bounty program"], category: "security" },
    { question: "What are security headers?", answer: "HTTP response headers that tell browsers how to behave securely — e.g., CSP (blocks injections), HSTS (forces HTTPS), X-Frame-Options (blocks clickjacking), X-Content-Type-Options.", keywords: ["security headers", "csp", "hsts", "x-frame-options", "content security policy", "http headers"], category: "security" },
    { question: "What is OWASP?", answer: "Open Web Application Security Project — a non-profit that publishes the OWASP Top 10, the industry-standard list of the most critical web vulnerabilities.", keywords: ["owasp", "owasp top 10", "what is owasp"], category: "security" },

    // ── OWASP TOP 10 (concise) ────────────────────────────────────────
    { question: "OWASP #1: Broken Access Control", answer: "Users exceed their permissions (IDOR, admin bypass). Fix: deny by default, enforce server-side checks on every request.", keywords: ["owasp 1", "owasp #1", "broken access control"], category: "security" },
    { question: "OWASP #2: Cryptographic Failures", answer: "Sensitive data exposed via weak/missing encryption (MD5 passwords, no HTTPS). Fix: bcrypt for passwords, HTTPS everywhere, AES-256 at rest.", keywords: ["owasp 2", "owasp #2", "cryptographic failures", "weak encryption"], category: "security" },
    { question: "OWASP #3: SQL Injection", answer: "Malicious SQL in inputs manipulates the database. Fix: parameterized queries, ORM, input validation.", keywords: ["owasp 3", "owasp #3", "sql injection", "sqli"], category: "security" },
    { question: "OWASP #4: Insecure Design", answer: "Architectural flaws like no rate limiting or account lockout. Fix: threat modeling during design phase.", keywords: ["owasp 4", "owasp #4", "insecure design"], category: "security" },
    { question: "OWASP #5: Security Misconfiguration", answer: "Default creds, open ports, verbose errors, missing headers. Fix: harden configs, disable unused features.", keywords: ["owasp 5", "owasp #5", "security misconfiguration"], category: "security" },
    { question: "OWASP #6: Vulnerable Components", answer: "Outdated libraries/frameworks with known CVEs. Fix: npm audit, keep dependencies updated.", keywords: ["owasp 6", "owasp #6", "vulnerable components", "outdated library"], category: "security" },
    { question: "OWASP #7: Auth Failures", answer: "Weak sessions, no brute-force protection, credential stuffing. Fix: MFA, secure cookies, rate limiting.", keywords: ["owasp 7", "owasp #7", "auth failures", "authentication failures"], category: "security" },
    { question: "OWASP #8: Integrity Failures", answer: "No verification of updates or packages (supply chain attacks, insecure deserialization). Fix: digital signatures, trusted CI/CD.", keywords: ["owasp 8", "owasp #8", "integrity failures", "deserialization"], category: "security" },
    { question: "OWASP #9: Logging Failures", answer: "No audit trail lets attackers operate undetected. Fix: log failed logins, access violations, high-value actions.", keywords: ["owasp 9", "owasp #9", "logging failures", "insufficient logging"], category: "security" },
    { question: "OWASP #10: SSRF", answer: "Server makes requests to internal/external URLs attacker controls. Fix: URL allowlist, block internal ranges.", keywords: ["owasp 10", "owasp #10", "ssrf", "server-side request forgery"], category: "security" },

    // ── SUPPORT ───────────────────────────────────────────────────────
    { question: "How do I contact support?", answer: "Email contact@hacksentinel.com or use the Live Chat in the Help tab. We respond within 24 hours.", keywords: ["contact support", "help", "email support", "reach support", "customer service"], category: "general" },
    { question: "Is my data secure?", answer: "Yes. All data is encrypted in transit (TLS) and at rest. Scan data is isolated per user. We never store sensitive credentials.", keywords: ["data secure", "is it secure", "privacy", "data safety", "encryption"], category: "security" },
    { question: "What browsers are supported?", answer: "HackSentinel works on all modern browsers: Chrome, Firefox, Edge, and Safari.", keywords: ["browser", "supported browser", "chrome", "firefox", "edge", "safari"], category: "technical" },

];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB for seeding...");
        await QA.deleteMany({});
        console.log("Cleared old Q&A data.");
        await QA.insertMany(initialQAs);
        console.log(`Successfully seeded ${initialQAs.length} Q&A entries!`);
        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
}

seed();
