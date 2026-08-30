import express from 'express';
import Chat from '../models/Chat.js';
import ScanResult from '../models/ScanResult.js';
import Report from '../models/Report.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { askGemini, explainReport } from '../services/gemini.js';
import { executeTool, getSystemContext } from '../services/agent.js';

const router = express.Router();

// POST /api/chat/send - Send a message and get response
router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { message, chatId } = req.body;
        const userId = req.user.userId;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ message: 'Message cannot be empty' });
        }

        let chat;

        if (chatId) {
            // Continue existing chat
            chat = await Chat.findOne({ _id: chatId, userId });
            if (!chat) {
                return res.status(404).json({ message: 'Chat not found' });
            }
        } else {
            // Create new chat
            chat = new Chat({
                userId,
                title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                messages: []
            });
        }

        // Add user message
        chat.messages.push({
            sender: 'user',
            content: message,
            timestamp: new Date()
        });

        // Get bot response
        let botResponse = null;

        // STEP 1: Detect 24-char ObjectID — fetch Report then ScanResult and let Gemini explain it
        const objectIdMatch = message.match(/[0-9a-fA-F]{24}/);

        if (objectIdMatch) {
            const parsedId = objectIdMatch[0];
            try {
                const reportData = await Report.findOne({ _id: parsedId, userId });
                if (reportData) {
                    const scanData = await ScanResult.findOne({ _id: reportData.scanId, userId });
                    botResponse = await explainReport(reportData, scanData, message);
                } else {
                    const scanData = await ScanResult.findOne({ _id: parsedId, userId });
                    if (scanData) {
                        botResponse = await explainReport(
                            { _id: parsedId, targetUrl: scanData.url, format: 'scan', reportData: {} },
                            scanData,
                            message
                        );
                    }
                }
            } catch (err) {
                console.log('Report/scan fetch or Gemini explain failed, falling through to general Gemini:', err.message);
            }
        }

        // STEP 2: General question — Gemini answers directly
        if (!botResponse) {
            try {
                // Inject current system context
                const context = await getSystemContext(userId);
                const enrichedMessage = `${context}\n\nUser Question: ${message}`;
                
                botResponse = await askGemini(enrichedMessage);
            } catch (geminiErr) {
                console.error('[Gemini ERROR]', geminiErr.message, geminiErr.status ?? '');

                // STEP 3: Last-resort hardcoded knowledge base
                const msgLower = message.toLowerCase();
                // Split into whole words for single-keyword matching so that
                // e.g. "hi" doesn't match "this" or "xss" doesn't match "express".
                const msgWords = new Set(msgLower.split(/\W+/).filter(Boolean));

                const kb = [
                    { keywords: ['hello', 'hi', 'hey', 'greetings'],
                      answer: 'Hello! I am the HackSentinel AI Security Assistant. I can help you understand vulnerabilities, explain your scan results, guide you through the platform, or answer cybersecurity questions. What would you like to know today?' },
                    { keywords: ['what is hacksentinel', 'about hacksentinel', 'what does hacksentinel'],
                      answer: 'HackSentinel is an AI-powered web application vulnerability scanner. It detects security flaws in websites using two phases: (1) Passive Scanning — analyses HTTP headers and server configuration without sending attack traffic, and (2) Active Scanning — fires AI-generated payloads and verifies results using a local LLM to eliminate false positives. Reports are exported as PDF, DOCX, Markdown, or HackerOne-ready format.' },
                    { keywords: ['start scan', 'how to scan', 'begin scan', 'run scan', 'scan a url', 'scan website'],
                      answer: 'To start a scan: (1) Go to your Dashboard, (2) Enter the target URL, (3) Check the authorization checkbox, (4) Click Scan. HackSentinel runs a passive then an active AI scan and saves all results to your history.' },
                    { keywords: ['report', 'download report', 'generate report', 'pdf report', 'hackerone'],
                      answer: 'HackSentinel generates professional reports in 8 formats: PDF, DOCX, Markdown, JSON, HackerOne, Bugcrowd, Intigriti, and YesWeHack. To generate one, complete a scan then use the "Export Security Report" dropdown. You can view all past reports under the Reports tab in your Dashboard. To ask me about a specific report, paste its Report ID from the Reports tab.' },
                    { keywords: ['plan', 'pricing', 'price', 'subscription', 'cost', 'upgrade'],
                      answer: 'HackSentinel offers 3 plans: FREE ($0/month) — 5 scans/month. PROFESSIONAL ($49/month) — Unlimited scans, PDF reports, AI insights, priority support. ENTERPRISE ($199/month) — Everything in Professional plus dedicated account manager, custom integrations, and SLA. Visit the Subscription tab to upgrade.' },
                    { keywords: ['contact', 'support', 'email us', 'reach us'],
                      answer: 'For support, email contact@hacksentinel.com. You can also open a Live Chat from your Dashboard for real-time assistance.' },
                    { keywords: ['sql injection', 'sqli', 'database injection'],
                      answer: 'SQL Injection (OWASP #3): An attacker inserts malicious SQL into input fields, enabling database extraction, authentication bypass, or data deletion. Fix: use parameterised queries / prepared statements and never concatenate user input into SQL strings.' },
                    { keywords: ['xss', 'cross site scripting', 'cross-site scripting'],
                      answer: 'Cross-Site Scripting (XSS): Attackers inject malicious JavaScript into pages viewed by other users. Impacts: session hijacking, account takeover, phishing. Fix: sanitise all input, use output encoding, and set a strict Content-Security-Policy header.' },
                    { keywords: ['ssrf', 'server side request forgery'],
                      answer: 'Server-Side Request Forgery (SSRF, OWASP #10): An attacker tricks the server into making requests to internal services or cloud metadata endpoints. Fix: validate all user-supplied URLs against an allowlist.' },
                    { keywords: ['csrf', 'cross-site request forgery'],
                      answer: 'Cross-Site Request Forgery (CSRF): An attacker tricks an authenticated user into submitting forged state-changing requests. Fix: use CSRF tokens on all state-changing endpoints and set the SameSite cookie attribute.' },
                    { keywords: ['idor', 'insecure direct object', 'broken access'],
                      answer: 'Insecure Direct Object Reference (IDOR): Attackers access other users\' data by manipulating object IDs in requests. Fix: enforce server-side ownership checks on every request — never rely on the client to send a correct user ID.' },
                    { keywords: ['rce', 'remote code execution', 'command injection'],
                      answer: 'Remote Code Execution (RCE): An attacker executes arbitrary OS commands on the server, leading to full system compromise. Fix: never pass unsanitised user input to shell commands; use safe APIs and parameterised calls instead.' },
                ];

                // Single-word keywords must match as whole words; phrase keywords use substring match.
                const matched = kb.find(entry => entry.keywords.some(kw =>
                    kw.includes(' ') ? msgLower.includes(kw) : msgWords.has(kw)
                ));
                botResponse = matched
                    ? matched.answer
                    : 'I am having trouble connecting to AI services right now. Please try again in a moment, or email contact@hacksentinel.com for support.';
            }
        } // Closing the 'if (!botResponse)' block from line 73

        if (!botResponse) {
            botResponse = "I'm having a bit of trouble connecting to my brain right now. Please try again in a minute, or check if Ollama is running locally!";
        }

        // Post-processing to strip out "thinking out loud" patterns
        const cleanAIOutput = (text) => {
            if (!text) return text;
            let cleaned = text
                // 1. Remove <think> blocks
                .replace(/<think>[\s\S]*?<\/think>/gi, '')
                // 2. Remove typical conversational "plan-talk" starts
                // Catches: "Okay, so I need to...", "Alright, let's...", "I will start by...", etc.
                .replace(/^(Okay|Alright|So|Well|I see|Sure|I understand|Looking at|Based on),?\s*(so\s*)?(I need to|I will|let's|I'll|I'm going to|I want to|the user is asking)[\s\S]*?\n/gi, '')
                // 3. Remove sentences that sound like internal planning
                .replace(/^Let's (break down|analyze|start by|begin by)[\s\S]*?\n/gi, '')
                .replace(/^I should (start|begin|explain|outline|provide)[\s\S]*?\n/gi, '')
                // 4. Remove leftover tool calls
                .replace(/\[TOOL_CALL:\s*[\s\S]*?\]/g, '')
                .trim();
            
            // If the AI output is still just a "plan" block (doesn't look like a report),
            // it's likely a failure. But we'll try to keep the meat.
            return cleaned;
        };

        // STEP 4: Handle Tool Calls
        let toolResults = [];
        console.log('[AI Raw Response]', botResponse);
        
        // Support optional space after colon and multiline args
        const toolCallMatch = botResponse.match(/\[TOOL_CALL:\s*(.*?)\(([\s\S]*?)\)\]/);
        
        if (toolCallMatch) {
            const toolName = toolCallMatch[1].trim();
            let toolArgs = {};
            try {
                toolArgs = JSON.parse(toolCallMatch[2]);
            } catch (e) {
                console.warn('[Agent] Failed to parse tool args:', toolCallMatch[2]);
            }

            const result = await executeTool(toolName, toolArgs, userId);
            toolResults.push({ tool: toolName, result });
        }

        // Now clean the response for the user
        botResponse = cleanAIOutput(botResponse);

        // Guard: if cleaning stripped everything (e.g. pure tool-call response)
        // the content field must not be empty — Mongoose requires it.
        if (!botResponse || botResponse.trim().length === 0) {
            if (toolResults.length > 0) {
                // A tool was executed — give the user action feedback
                const tr = toolResults[0];
                const target = tr.result?.target || tr.result?.page || '';
                botResponse = target
                    ? `✅ Taking you to **${target}** now...`
                    : `✅ Action executed successfully.`;
            } else {
                botResponse = "I'm having trouble responding right now. Please try again.";
            }
        }

        // Add bot response
        chat.messages.push({
            sender: 'bot',
            content: botResponse,
            timestamp: new Date(),
            toolResults: toolResults.length > 0 ? toolResults : undefined
        });

        await chat.save();

        res.json({
            success: true,
            chatId: chat._id,
            message: 'Message sent successfully',
            botResponse,
            toolResults,
            chat: {
                _id: chat._id,
                title: chat.title,
                status: chat.status,
                messages: chat.messages,
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt
            }
        });
    } catch (error) {
        console.error('Chat send error:', error);

        // Write error to a log file so I can see it
        try {
            const fs = await import('fs');
            const logMsg = `[${new Date().toISOString()}] Chat Error: ${error.message}\nStack: ${error.stack}\n\n`;
            fs.appendFileSync('chatbot_errors.log', logMsg);
        } catch (fsErr) {
            console.error('Failed to write to log file:', fsErr);
        }

        res.status(500).json({ 
            message: 'Failed to send message', 
            error: error.message,
            tip: 'Check chatbot_errors.log in the backend folder'
        });
    }
});

// GET /api/chat/history - Get all chat sessions for user
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        const chats = await Chat.find({ userId })
            .sort({ updatedAt: -1 })
            .select('_id title status createdAt updatedAt messages')
            .lean();

        // Add preview of last message
        const chatsWithPreview = chats.map(chat => ({
            ...chat,
            lastMessage: chat.messages.length > 0
                ? chat.messages[chat.messages.length - 1].content.substring(0, 100)
                : '',
            messageCount: chat.messages.length
        }));

        res.json({
            success: true,
            chats: chatsWithPreview
        });
    } catch (error) {
        console.error('Chat history error:', error);
        res.status(500).json({ message: 'Failed to fetch chat history', error: error.message });
    }
});

// GET /api/chat/history/:chatId - Get specific chat conversation
router.get('/history/:chatId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { chatId } = req.params;

        const chat = await Chat.findOne({ _id: chatId, userId });

        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        res.json({
            success: true,
            chat
        });
    } catch (error) {
        console.error('Chat fetch error:', error);
        res.status(500).json({ message: 'Failed to fetch chat', error: error.message });
    }
});

// DELETE /api/chat/history/:chatId - Delete chat conversation
router.delete('/history/:chatId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { chatId } = req.params;

        const chat = await Chat.findOneAndDelete({ _id: chatId, userId });

        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        res.json({
            success: true,
            message: 'Chat deleted successfully'
        });
    } catch (error) {
        console.error('Chat delete error:', error);
        res.status(500).json({ message: 'Failed to delete chat', error: error.message });
    }
});

// POST /api/chat/close/:chatId - Close a chat session
router.post('/close/:chatId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { chatId } = req.params;

        const chat = await Chat.findOneAndUpdate(
            { _id: chatId, userId },
            { status: 'closed' },
            { new: true }
        );

        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        res.json({
            success: true,
            message: 'Chat closed successfully',
            chat
        });
    } catch (error) {
        console.error('Chat close error:', error);
        res.status(500).json({ message: 'Failed to close chat', error: error.message });
    }
});

export default router;
