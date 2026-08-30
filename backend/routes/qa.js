import express from 'express';
import QA from '../models/QA.js';
import { adminAuth as adminMiddleware } from '../middleware/adminAuth.js';
import { askGemini } from '../services/gemini.js';

const router = express.Router();

// Answer matching algorithm (reused for public query endpoint)
function findBestMatch(userQuery, qaDatabase) {
    if (!qaDatabase || qaDatabase.length === 0) {
        return null;
    }

    const queryWords = userQuery.toLowerCase().split(/\s+/).filter(word => word.length > 2);

    const scored = qaDatabase.map(qa => {
        let score = 0;

        // Check keywords safely
        (qa.keywords || []).forEach(keyword => {
            if (queryWords.some(word => word.includes(keyword) || keyword.includes(word))) {
                score += 3;
            }
        });

        // Check question similarity safely
        const questionWords = (qa.question || '').toLowerCase().split(/\s+/);
        queryWords.forEach(word => {
            if (questionWords.some(qWord => qWord.includes(word) || word.includes(qWord))) {
                score += 1;
            }
        });

        return { ...qa._doc, score };
    });

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Return best match if score is above threshold
    return scored[0] && scored[0].score > 1 ? scored[0] : null;
}

// ---------------- PUBLIC ROUTES ----------------

import Unanswered from '../models/Unanswered.js';

const BAD_WORDS = ['abuse', 'badword', 'stupid', 'idiot', 'scam', 'fake']; // Add more as needed

// POST /api/qa/query - Public endpoint for chatbot query
router.post('/query', async (req, res) => {
    try {
        const { question } = req.body;

        if (!question || question.trim().length === 0) {
            return res.status(400).json({ message: 'Question cannot be empty' });
        }

        // Profanity Check
        const lowerQuestion = question.toLowerCase();
        const hasProfanity = BAD_WORDS.some(word => lowerQuestion.includes(word));

        if (hasProfanity) {
            return res.json({
                success: false,
                lock: true,
                answer: "⚠️ Your message violates our community guidelines. This chat session has been locked. Please refresh the page to start a new session."
            });
        }

        // Get bot response
        let botResponse = null;

        // STEP 1: Try QA DB first
        try {
            const activeQAs = await QA.find({ isActive: true });
            const bestMatch = findBestMatch(question, activeQAs);
            if (bestMatch) {
                await QA.findByIdAndUpdate(bestMatch._id, { $inc: { usageCount: 1 } });
                return res.json({ success: true, answer: bestMatch.answer, matchedId: bestMatch._id });
            }
        } catch (dbErr) {
            console.log('QA DB unavailable, trying LLM...');
        }

        // STEP 2: Gemini answers directly
        try {
            botResponse = await askGemini(question);
        } catch (geminiErr) {
            console.log('Gemini unavailable for public QA, falling back to built-in knowledge:', geminiErr.message);
        }

        if (botResponse) {
            return res.json({ success: true, answer: botResponse });
        }

        // STEP 3: Last-resort hardcoded knowledge base
        const msgLower = question.toLowerCase();
        const kb = [
            // ── PLATFORM QUESTIONS ─────────────────────────────────────────
            { keywords: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good evening'],
              answer: 'Hello! I am the HackSentinel AI Security Assistant. I can help you understand vulnerabilities, explore HackSentinel features, or answer general cybersecurity questions. Sign in to your dashboard to get AI explanations of your own scan results!' },

            { keywords: ['what is hacksentinel', 'about hacksentinel', 'what does hacksentinel do'],
              answer: 'HackSentinel is an AI-powered web application vulnerability scanner. It detects security flaws using two phases: Passive Scanning (silently analyzes headers and configs) and Active Scanning (fires AI-generated payloads and verifies results with an LLM). It generates professional PDF, DOCX, and HackerOne-format reports.' },

            { keywords: ['start scan', 'how to scan', 'begin scan', 'scan a url', 'scan website', 'how do i scan'],
              answer: 'To start a scan: Sign in, go to your Dashboard, enter the target URL in the "Start New Vulnerability Scan" box, check the authorization checkbox (confirming you have permission), and click Scan. HackSentinel will run a full passive + active AI scan and save the results to your history automatically.' },

            { keywords: ['report', 'download report', 'generate report', 'pdf', 'docx', 'hackerone format'],
              answer: 'HackSentinel generates reports in 4 formats: PDF (executive summary with visual charts), DOCX (editable Word document), Markdown (plain text), and HackerOne format (for bug bounty submissions). After any scan, go to the Reports tab in your dashboard to download them.' },

            { keywords: ['passive scan', 'passive scanning', 'reconnaissance'],
              answer: 'Passive Scanning is Phase 1 of HackSentinel. It silently observes the target WITHOUT sending attack payloads. It checks for missing HTTP security headers (CSP, HSTS, X-Frame-Options), exposed server software versions, technology stack fingerprinting, and information leakage in server responses.' },

            { keywords: ['active scan', 'active scanning', 'ai payload', 'payload generation'],
              answer: 'Active Scanning is Phase 2 of HackSentinel. The AI Payload Generator creates custom attack strings tailored to the target site\'s specific inputs and tests for SQL Injection, XSS, Command Injection, Path Traversal, and more. A second LLM then verifies whether the attack truly succeeded — eliminating false positives.' },

            { keywords: ['plan', 'pricing', 'price', 'subscription', 'cost', 'upgrade', 'free', 'professional', 'enterprise'],
              answer: 'HackSentinel has 3 plans: FREE ($0/month) — 5 scans/month + basic reports. PROFESSIONAL ($49/month) — Unlimited scans, AI insights, PDF reports, priority support. ENTERPRISE ($199/month) — Everything + dedicated account manager, custom integrations, and SLA guarantees. Sign in and go to the Subscription tab to upgrade.' },

            { keywords: ['contact', 'support', 'help', 'email', 'reach'],
              answer: 'Need help? Email the HackSentinel team at contact@hacksentinel.com. You can also use the Live Chat in your dashboard for real-time assistance, or browse the Help tab for step-by-step guides on scanning, reports, and account settings.' },

            { keywords: ['2fa', 'two factor', 'otp', 'one time password', 'authentication'],
              answer: 'HackSentinel supports Two-Factor Authentication (2FA) via email OTP. Enable it in the Settings tab of your Dashboard. Once active, every sign-in will require a one-time code sent to your email, significantly increasing your account security.' },

            // ── OWASP TOP 10 ───────────────────────────────────────────────
            { keywords: ['broken access control', 'access control', 'unauthorized access', 'privilege', 'idor', 'owasp 1', 'owasp #1'],
              answer: 'OWASP #1 — Broken Access Control: Users can perform actions beyond their intended permissions. Examples: accessing another user\'s account (IDOR), viewing admin pages without authorization, or modifying URLs to access restricted data. Fix: Enforce strict server-side access control on every request. Deny access by default and only allow explicitly authorized actions.' },

            { keywords: ['cryptographic failure', 'weak encryption', 'sensitive data exposure', 'data exposure', 'plain text', 'md5', 'sha1', 'owasp 2', 'owasp #2'],
              answer: 'OWASP #2 — Cryptographic Failures: Sensitive data (passwords, credit cards, health records) is stored or transmitted without proper encryption. Examples: MD5/SHA1 passwords, unencrypted HTTP connections, plain-text stored passwords. Fix: Use bcrypt or Argon2 for passwords, enforce HTTPS with HSTS, and encrypt all sensitive data at rest using AES-256.' },

            { keywords: ['sql injection', 'sqli', 'sql', 'database injection', 'owasp 3', 'owasp #3'],
              answer: 'OWASP #3 — SQL Injection: Attackers insert malicious SQL code into input fields (login forms, search boxes) that gets executed by the database. Results: unauthorized data access, deletion, authentication bypass, or full database takeover. Fix: Always use parameterized queries or prepared statements. Never concatenate raw user input into SQL strings. Use an ORM and input validation.' },

            { keywords: ['insecure design', 'design flaw', 'threat modeling', 'security by design', 'owasp 4', 'owasp #4'],
              answer: 'OWASP #4 — Insecure Design: Security flaws built into the application architecture itself, not just coding bugs. Examples: no account lockout (enabling brute-force), no rate limiting on OTP/password reset flows. Fix: Apply Threat Modeling during design, use secure design patterns, define security requirements before writing any code.' },

            { keywords: ['security misconfiguration', 'misconfiguration', 'default password', 'default credentials', 'directory listing', 'owasp 5', 'owasp #5'],
              answer: 'OWASP #5 — Security Misconfiguration: The most widespread vulnerability. Examples: unchanged default admin credentials, unnecessary features enabled, verbose error messages leaking stack traces, directory listing enabled, missing security headers. Fix: Harden all server/cloud configs, disable all unused features and ports, implement security headers, and conduct regular configuration audits.' },

            { keywords: ['vulnerable component', 'outdated library', 'outdated software', 'old version', 'cve', 'log4j', 'owasp 6', 'owasp #6'],
              answer: 'OWASP #6 — Vulnerable and Outdated Components: Using frameworks, libraries, or software with publicly known CVEs. Example: running an old Log4j version (Log4Shell), outdated jQuery, or unpatched server OS. Fix: Regularly audit dependencies with npm audit / pip check, subscribe to CVE security advisories, and enforce a policy of keeping all components updated.' },

            { keywords: ['authentication failure', 'broken auth', 'weak password', 'brute force', 'session', 'credential stuffing', 'owasp 7', 'owasp #7'],
              answer: 'OWASP #7 — Identification and Authentication Failures: Weaknesses in login systems that allow attackers to compromise accounts. Examples: weak passwords, no account lockout (brute force), session IDs in URLs, credential stuffing from leaked databases. Fix: Enforce strong passwords, implement MFA/2FA, use secure session tokens (httpOnly, Secure cookies), and rate-limit all authentication endpoints.' },

            { keywords: ['software integrity', 'data integrity', 'deserialization', 'supply chain attack', 'unsigned', 'owasp 8', 'owasp #8'],
              answer: 'OWASP #8 — Software and Data Integrity Failures: Not verifying that software, updates, or data comes from a trusted source. Examples: insecure deserialization of user-supplied objects, or using unverified third-party packages (supply chain attacks). Fix: Verify digital signatures of packages, use a trusted CI/CD pipeline with integrity checks, and never deserialize data from untrusted sources.' },

            { keywords: ['logging failure', 'monitoring failure', 'insufficient logging', 'no audit', 'audit log', 'detect breach', 'owasp 9', 'owasp #9'],
              answer: 'OWASP #9 — Security Logging and Monitoring Failures: Without proper logging, attackers can operate undetected for months. Key events to log: failed logins, access control violations, admin actions, and input validation failures. Fix: Implement centralized logging (ELK Stack, Splunk), configure real-time alerts for suspicious activity, and regularly audit your logs.' },

            { keywords: ['ssrf', 'server side request forgery', 'server-side request', 'internal request', 'metadata endpoint', 'owasp 10', 'owasp #10'],
              answer: 'OWASP #10 — Server-Side Request Forgery (SSRF): The server is tricked into making requests to unintended internal or external URLs. Example: manipulating a URL input to access http://localhost/admin or AWS metadata at http://169.254.169.254 to steal cloud credentials. Fix: Validate all user-supplied URLs, use allowlists for permitted destinations, disable unused URL-fetching features, and block internal network access from public services.' },

            // ── ADDITIONAL VULNERABILITIES ─────────────────────────────────
            { keywords: ['xss', 'cross-site scripting', 'cross site scripting', 'javascript injection'],
              answer: 'Cross-Site Scripting (XSS): Attackers inject malicious JavaScript into web pages viewed by other users. Types: Stored XSS (persisted in DB), Reflected XSS (in URL), DOM-based XSS (in browser). Impacts: session cookie theft, account takeover, phishing redirects. Fix: Sanitize all user input, use output encoding, implement a strict Content-Security-Policy (CSP) header, and avoid using innerHTML with untrusted data.' },

            { keywords: ['command injection', 'os command', 'shell injection', 'rce', 'remote code execution'],
              answer: 'Command Injection / Remote Code Execution (RCE): User input is passed directly to OS shell commands, allowing attackers to execute arbitrary commands on the server. Example: a ping tool that accepts "127.0.0.1; cat /etc/passwd". Fix: Never pass user input to shell commands. Use safe language APIs, validate inputs strictly against an allowlist, and run services with minimal OS privileges.' },

            { keywords: ['path traversal', 'directory traversal', 'dot dot', '../', 'file inclusion'],
              answer: 'Path Traversal: Attackers use "../" sequences in file path inputs to escape the web root and access sensitive server files. Example: requesting "../../../../etc/passwd" to read the server\'s password file. Fix: Canonicalize all file paths before use, validate paths against a strict allowlist, use chroot jails, and never construct file paths directly from user input.' },

            { keywords: ['csrf', 'cross-site request forgery', 'forged request', 'fake request'],
              answer: 'Cross-Site Request Forgery (CSRF): An attacker tricks a logged-in user into unknowingly submitting a forged request to a trusted site (e.g., a hidden form that transfers funds). Fix: Use CSRF tokens on all state-changing requests (POST/PUT/DELETE), set the SameSite=Strict cookie attribute, and validate the Origin and Referer headers on sensitive endpoints.' },

            { keywords: ['clickjacking', 'x-frame-options', 'iframe attack', 'ui redress'],
              answer: 'Clickjacking: An attacker embeds your site in an invisible iframe over a fake page, tricking users into clicking UI elements they cannot see (e.g., secretly approving a transaction). Fix: Set the X-Frame-Options: DENY or SAMEORIGIN header, or use the Content-Security-Policy: frame-ancestors \'none\' directive to prevent your site from being framed.' },

            { keywords: ['open redirect', 'unvalidated redirect', 'redirect attack', 'phishing url'],
              answer: 'Open Redirect: The application redirects users to attacker-controlled URLs without validation. Used for phishing — making a victim trust a legitimate-looking URL that then bounces to a malicious site. Fix: Never use user-supplied input as a redirect destination. Use an ID-based redirect map or validate all redirect URLs strictly against an allowlist of trusted domains.' },

            { keywords: ['cvss', 'severity score', 'critical vulnerability', 'high severity', 'medium severity', 'low severity', 'vulnerability score'],
              answer: 'CVSS (Common Vulnerability Scoring System) rates vulnerabilities from 0-10: CRITICAL (9.0-10.0) — Patch immediately, trivially exploitable with catastrophic impact. HIGH (7.0-8.9) — Fix within days, significant risk. MEDIUM (4.0-6.9) — Fix within weeks, moderate risk. LOW (0.1-3.9) — Fix in normal maintenance cycle. NONE (0.0) — No risk. HackSentinel displays CVSS severity levels in all scan reports.' },

            { keywords: ['penetration testing', 'pentest', 'ethical hacking', 'bug bounty', 'responsible disclosure'],
              answer: 'Penetration Testing (Ethical Hacking) is the authorized practice of attacking your own systems to discover vulnerabilities before malicious actors do. HackSentinel automates this. Bug Bounty programs (HackerOne, Bugcrowd) let security researchers report vulnerabilities to companies for monetary rewards. HackSentinel generates HackerOne-format reports ready for direct submission.' },
        ];

        // Post-processing to strip out "thinking out loud" patterns
        const cleanAIOutput = (text) => {
            if (!text) return text;
            let cleaned = text
                // 1. Remove <think> blocks
                .replace(/<think>[\s\S]*?<\/think>/gi, '')
                // 2. Remove typical conversational "plan-talk" starts
                .replace(/^(Okay|Alright|So|Well|I see|Sure|I understand|Looking at|Based on),?\s*(so\s*)?(I need to|I will|let's|I'll|I'm going to|I want to|the user is asking)[\s\S]*?\n/gi, '')
                // 3. Remove sentences that sound like internal planning
                .replace(/^Let's (break down|analyze|start by|begin by)[\s\S]*?\n/gi, '')
                .replace(/^I should (start|begin|explain|outline|provide)[\s\S]*?\n/gi, '')
                // 4. Remove leftover tool calls
                .replace(/\[TOOL_CALL:\s*[\s\S]*?\]/g, '')
                .trim();
            return cleaned;
        };

        if (botResponse) {
            botResponse = cleanAIOutput(botResponse);
        }

        const matched = kb.find(entry => entry.keywords.some(kw => msgLower.includes(kw)));
        const finalAnswer = matched ? matched.answer : (botResponse || 'I can help with cybersecurity questions and HackSentinel features! Try asking about: any OWASP Top 10 vulnerability, SQL Injection, XSS, SSRF, CSRF, how to start a scan, how to download reports, pricing plans, or 2FA setup. Sign in to ask me to explain your specific scan results!');

        return res.json({
            success: true,
            answer: finalAnswer
        }); 

    } catch (error) {
        console.error('QA query error:', error);
        
        // Write error to a log file so I can see it
        try {
            const fs = await import('fs');
            const logMsg = `[${new Date().toISOString()}] QA Error: ${error.message}\nStack: ${error.stack}\n\n`;
            fs.appendFileSync('chatbot_errors.log', logMsg);
        } catch (fsErr) {
            console.error('Failed to write to log file:', fsErr);
        }

        res.status(500).json({ 
            message: 'Failed to process query', 
            error: error.message,
            tip: 'Check chatbot_errors.log in the backend folder'
        });
    }
});

// ---------------- ADMIN ROUTES ----------------

// GET /api/qa/admin/list - List all Q&A pairs
router.get('/admin/list', adminMiddleware, async (req, res) => {
    try {
        const { category, search } = req.query;

        let query = {};
        if (category && category !== 'all') {
            query.category = category;
        }

        if (search) {
            query.$text = { $search: search };
        }

        const qas = await QA.find(query).sort({ usageCount: -1, createdAt: -1 });

        res.json({
            success: true,
            count: qas.length,
            qas
        });
    } catch (error) {
        console.error('QA list error:', error);
        res.status(500).json({ message: 'Failed to fetch Q&A list', error: error.message });
    }
});

// POST /api/qa/admin/add - Add new Q&A pair
router.post('/admin/add', adminMiddleware, async (req, res) => {
    try {
        const { question, answer, keywords, category, isActive } = req.body;
        const adminId = req.admin?.id || req.admin?._id;

        if (!question || !answer) {
            return res.status(400).json({ message: 'Question and answer are required' });
        }

        const newQA = new QA({
            question,
            answer,
            keywords: keywords || [],
            category: category || 'general',
            isActive: isActive !== undefined ? isActive : true,
            createdBy: adminId
        });

        await newQA.save();

        res.status(201).json({
            success: true,
            message: 'Q&A pair added successfully',
            qa: newQA
        });
    } catch (error) {
        console.error('QA add error:', error);
        res.status(500).json({ message: 'Failed to add Q&A pair', error: error.message });
    }
});

// PUT /api/qa/admin/update/:id - Update Q&A pair
router.put('/admin/update/:id', adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const updatedQA = await QA.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedQA) {
            return res.status(404).json({ message: 'Q&A pair not found' });
        }

        res.json({
            success: true,
            message: 'Q&A pair updated successfully',
            qa: updatedQA
        });
    } catch (error) {
        console.error('QA update error:', error);
        res.status(500).json({ message: 'Failed to update Q&A pair', error: error.message });
    }
});

// DELETE /api/qa/admin/delete/:id - Delete Q&A pair
router.delete('/admin/delete/:id', adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const deletedQA = await QA.findByIdAndDelete(id);

        if (!deletedQA) {
            return res.status(404).json({ message: 'Q&A pair not found' });
        }

        res.json({
            success: true,
            message: 'Q&A pair deleted successfully'
        });
    } catch (error) {
        console.error('QA delete error:', error);
        res.status(500).json({ message: 'Failed to delete Q&A pair', error: error.message });
    }
});

// GET /api/qa/admin/stats - Get Q&A statistics
router.get('/admin/stats', adminMiddleware, async (req, res) => {
    try {
        const totalCount = await QA.countDocuments();
        const activeCount = await QA.countDocuments({ isActive: true });

        const categoryStats = await QA.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } }
        ]);

        const topQuestions = await QA.find({})
            .sort({ usageCount: -1 })
            .limit(5)
            .select('question usageCount category');

        res.json({
            success: true,
            stats: {
                total: totalCount,
                active: activeCount,
                byCategory: categoryStats,
                topQuestions
            }
        });
    } catch (error) {
        console.error('QA stats error:', error);
        res.status(500).json({ message: 'Failed to fetch Q&A stats', error: error.message });
    }
});

export default router;
