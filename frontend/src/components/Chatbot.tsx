import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Chatbot.css';

interface Message {
    sender: 'user' | 'bot';
    content: string;
    timestamp: Date;
}

interface ChatbotProps {
    position?: 'bottom-right' | 'bottom-left';
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:5000';

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE ACTION ENGINE
// Detects intent from user message and executes real system actions.
// This fires BEFORE the AI response so actions are instant and reliable.
// ─────────────────────────────────────────────────────────────────────────────

interface ActionResult {
    handled: boolean;
    botReply?: string;
    navigateTo?: string;       // React Router path
    adminTab?: string;         // Admin custom event tab name
    delayNav?: number;         // ms delay before navigate (default 1500)
}

async function detectAndRunAction(
    msg: string,
    token: string | null,
    isAdmin: boolean
): Promise<ActionResult> {
    const m = msg.toLowerCase().trim();

    // ── 1. NAVIGATION INTENTS ─────────────────────────────────────────────────
    const navRules: { patterns: string[]; userPath: string; adminTab: string; label: string }[] = [
        {
            patterns: ['go to dashboard', 'open dashboard', 'show dashboard', 'take me to dashboard', 'navigate to dashboard', 'back to dashboard'],
            userPath: '/dashboard?tab=dashboard', adminTab: 'dashboard', label: 'Dashboard'
        },
        {
            patterns: ['go to reports', 'open reports', 'show my reports', 'view my reports', 'view reports', 'my reports', 'take me to reports', 'navigate to reports', 'show reports'],
            userPath: '/dashboard?tab=reports', adminTab: 'analytics', label: 'Reports'
        },
        {
            patterns: ['go to settings', 'open settings', 'show settings', 'navigate to settings', 'account settings', 'my settings'],
            userPath: '/dashboard?tab=settings', adminTab: 'settings', label: 'Settings'
        },
        {
            patterns: ['scan history', 'view scans', 'my scans', 'go to scans', 'open scans', 'go to history', 'open history', 'view history', 'show history', 'past scans'],
            userPath: '/dashboard?tab=history', adminTab: 'history', label: 'Scan History'
        },
        {
            patterns: ['go to subscription', 'open subscription', 'my plan', 'view plans', 'upgrade plan', 'billing', 'pricing', 'upgrade subscription', 'change plan'],
            userPath: '/dashboard?tab=plans', adminTab: 'settings', label: 'Subscription'
        },
        {
            patterns: ['go to help', 'open help', 'get help', 'need support', 'contact support'],
            userPath: '/dashboard?tab=help', adminTab: 'settings', label: 'Help'
        },
        // Admin-only
        {
            patterns: ['go to users', 'manage users', 'user management', 'view users', 'all users', 'user list'],
            userPath: '/dashboard', adminTab: 'users', label: 'Users'
        },
        {
            patterns: ['go to analytics', 'view analytics', 'open analytics', 'show analytics', 'view stats', 'open stats'],
            userPath: '/dashboard', adminTab: 'analytics', label: 'Analytics'
        },
        {
            patterns: ['go to notifications', 'view notifications', 'broadcast', 'send alert', 'push notification'],
            userPath: '/dashboard', adminTab: 'notifications', label: 'Notifications'
        },
    ];

    for (const rule of navRules) {
        if (rule.patterns.some(p => m.includes(p))) {
            if (isAdmin && rule.adminTab) {
                return {
                    handled: true,
                    botReply: `✅ Taking you to **${rule.label}** now...`,
                    adminTab: rule.adminTab,
                    delayNav: 1200
                };
            } else {
                return {
                    handled: true,
                    botReply: `✅ Taking you to **${rule.label}** now...`,
                    navigateTo: rule.userPath,
                    delayNav: 1200
                };
            }
        }
    }

    // ── 2. START SCAN ──────────────────────────────────────────────────────────
    const scanTriggers = ['scan ', 'scan this', 'check ', 'test ', 'audit ', 'analyse ', 'analyze '];
    const wantsScan = scanTriggers.some(t => m.startsWith(t)) ||
        m.includes('run a scan') || m.includes('start a scan') || m.includes('start scan') ||
        m.includes('scan for vulnerabilities') || m.includes('vulnerability scan');

    if (wantsScan) {
        // Try to extract a URL from the message
        const urlRegex = /https?:\/\/[^\s]+|(?:www\.)[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/i;
        const urlMatch = msg.match(urlRegex);

        if (!urlMatch) {
            // No URL found — ask for it
            return {
                handled: true,
                botReply: `🔍 I'd love to start a scan for you! Please provide the target URL, for example:\n\n**"Scan https://example.com"**`
            };
        }

        const targetUrl = urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`;

        if (!token) {
            return {
                handled: true,
                botReply: `⚠️ You need to be **logged in** to start a scan. Please sign in first.`
            };
        }

        // Confirm and navigate to scan page — the actual scan is started from Dashboard
        return {
            handled: true,
            botReply: `🚀 Starting a passive scan for **${targetUrl}**...\n\nI'm taking you to the scan page now. The scan will run automatically!`,
            navigateTo: `/dashboard?tab=dashboard&autoScan=${encodeURIComponent(targetUrl)}`,
            delayNav: 1800
        };
    }

    // ── 3. LIST RECENT SCANS ───────────────────────────────────────────────────
    const wantsScans = ['show my scans', 'recent scans', 'list scans', 'last scan', 'my last scans',
        'what did i scan', 'scan results', 'list my scans', 'show recent scans'].some(p => m.includes(p));

    if (wantsScans) {
        if (!token) {
            return { handled: true, botReply: `⚠️ Please log in to view your scan history.` };
        }
        try {
            const res = await fetch(`${API_BASE}/api/scan/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const scans = await res.json();
            if (!Array.isArray(scans) || scans.length === 0) {
                return { handled: true, botReply: `📭 You haven't run any scans yet. Say **"Scan https://yoursite.com"** to get started!` };
            }
            const top5 = scans.slice(0, 5);
            const list = top5.map((s: any, i: number) =>
                `${i + 1}. **${s.url}** — ${s.status} _(${new Date(s.scanDate).toLocaleDateString()})_`
            ).join('\n');
            return {
                handled: true,
                botReply: `📋 **Your Recent Scans:**\n\n${list}\n\nTo view full details, go to your **Scan History** tab.`,
                navigateTo: '/dashboard?tab=history',
                delayNav: 3000
            };
        } catch {
            return { handled: true, botReply: `⚠️ Couldn't fetch your scans right now. Please check your connection or visit the Scan History tab.` };
        }
    }

    // ── 4. LIST REPORTS ────────────────────────────────────────────────────────
    const wantsReports = ['show my reports', 'list reports', 'list my reports', 'my reports list',
        'recent reports', 'what reports', 'available reports', 'generated reports'].some(p => m.includes(p));

    if (wantsReports) {
        if (!token) {
            return { handled: true, botReply: `⚠️ Please log in to view your reports.` };
        }
        try {
            const res = await fetch(`${API_BASE}/api/report/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const reports = await res.json();
            if (!Array.isArray(reports) || reports.length === 0) {
                return { handled: true, botReply: `📭 No reports generated yet. Complete a scan and export it to generate a report!` };
            }
            const top5 = reports.slice(0, 5);
            const list = top5.map((r: any, i: number) =>
                `${i + 1}. **${r.targetUrl}** — ${r.format?.toUpperCase()} _(${new Date(r.createdAt).toLocaleDateString()})_`
            ).join('\n');
            return {
                handled: true,
                botReply: `📄 **Your Recent Reports:**\n\n${list}\n\nHeading to your Reports tab...`,
                navigateTo: '/dashboard?tab=reports',
                delayNav: 3000
            };
        } catch {
            return { handled: true, botReply: `⚠️ Couldn't fetch your reports right now. Please visit the Reports tab.` };
        }
    }

    // ── 5. SYSTEM STATUS ───────────────────────────────────────────────────────
    const wantsStatus = ['system status', 'is the system online', 'is the scanner online', 'scanner status',
        'ai status', 'check status', 'server status', 'is hacksentinel running', 'system health'].some(p => m.includes(p));

    if (wantsStatus) {
        try {
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`${API_BASE}/api/scan/ai-status`, { headers });
            if (res.ok) {
                const data = await res.json();
                const aiOk = data.available ? '✅ Online' : '⚠️ Offline (passive scan only)';
                const pyOk = data.python_api ? '✅ Running' : '❌ Down';
                return {
                    handled: true,
                    botReply: `🖥️ **HackSentinel System Status:**\n\n- **Python Scan Engine:** ${pyOk}\n- **AI Model (Ollama):** ${aiOk}\n- **Backend API:** ✅ Online\n\n${data.available ? 'All systems operational. Ready to scan! 🚀' : 'AI model is offline — passive scans still work perfectly.'}`
                };
            }
        } catch { /* fall through */ }
        return {
            handled: true,
            botReply: `🖥️ **HackSentinel System Status:**\n\n- **Backend API:** ✅ Online\n- **Scan Engine:** Status unknown (checking failed)\n\nThe backend is reachable. Try running a passive scan!`
        };
    }

    // ── 6. MY SUBSCRIPTION / PLAN ─────────────────────────────────────────────
    const wantsPlan = ['what is my plan', 'my current plan', 'current subscription', 'what plan am i on',
        'am i on free', 'subscription status', 'show my subscription'].some(p => m.includes(p));

    if (wantsPlan) {
        if (!token) {
            return { handled: true, botReply: `⚠️ Please log in to check your subscription.` };
        }
        try {
            const res = await fetch(`${API_BASE}/api/subscription/current`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            const sub = data.subscription;
            if (sub) {
                const planName = sub.plan?.charAt(0).toUpperCase() + sub.plan?.slice(1) || 'Free';
                const status = sub.status || 'active';
                const end = sub.endDate ? `Renews: ${new Date(sub.endDate).toLocaleDateString()}` : 'No expiry';
                return {
                    handled: true,
                    botReply: `💳 **Your Subscription:**\n\n- **Plan:** ${planName}\n- **Status:** ${status}\n- **${end}**\n\nWant to upgrade? Say **"Go to subscription"** or visit the Plans tab.`
                };
            }
        } catch { /* fall through */ }
        return { handled: true, botReply: `⚠️ Couldn't fetch your subscription details. Please visit the Plans tab.` };
    }

    // ── 7. LOGOUT ─────────────────────────────────────────────────────────────
    const wantsLogout = ['log out', 'logout', 'sign out', 'signout'].some(p => m.includes(p));
    if (wantsLogout) {
        return {
            handled: true,
            botReply: `👋 Logging you out now...`,
            navigateTo: '/logout',
            delayNav: 1500
        };
    }

    return { handled: false };
}

// ─────────────────────────────────────────────────────────────────────────────

const Chatbot: React.FC<ChatbotProps> = ({ position = 'bottom-right' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Auth gate — the chatbot only renders for authenticated users (user or admin session).
    // On public/marketing pages (Landing, About, Services, etc.) it stays hidden until sign-in.
    const [isAuthed, setIsAuthed] = useState<boolean>(() => (
        !!localStorage.getItem('hs_auth_token') || !!localStorage.getItem('hs_admin_token')
    ));

    useEffect(() => {
        const check = () => setIsAuthed(
            !!localStorage.getItem('hs_auth_token') || !!localStorage.getItem('hs_admin_token')
        );
        window.addEventListener('storage', check);
        window.addEventListener('hs_auth_change', check);
        return () => {
            window.removeEventListener('storage', check);
            window.removeEventListener('hs_auth_change', check);
        };
    }, []);

    const quickQuestions = [
        "Show my recent scans",
        "What vulnerabilities can you detect?",
        "Check system status",
        "Go to reports",
    ];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([{
                sender: 'bot',
                content: "👋 Hello! I'm your HackSentinel assistant. I can **navigate pages**, **start scans**, **show your reports**, and answer security questions. How can I help?",
                timestamp: new Date()
            }]);
        }
    }, [isOpen]);

    const addBotMessage = (content: string) => {
        setMessages(prev => [...prev, { sender: 'bot', content, timestamp: new Date() }]);
    };

    const handleSendMessage = async (message?: string) => {
        const messageToSend = message || inputMessage.trim();
        if (!messageToSend) return;

        // Add user message
        setMessages(prev => [...prev, { sender: 'user', content: messageToSend, timestamp: new Date() }]);
        setInputMessage('');
        setIsLoading(true);

        const token = localStorage.getItem('hs_auth_token');
        const isAdmin = window.location.pathname.includes('/admin');

        try {
            // ── STEP 1: Run client-side action engine first ──────────────────
            const actionResult = await detectAndRunAction(messageToSend, token, isAdmin);

            if (actionResult.handled) {
                // Show the action reply immediately
                if (actionResult.botReply) {
                    addBotMessage(actionResult.botReply);
                }

                // Execute navigation with optional delay
                const delay = actionResult.delayNav ?? 1500;
                if (actionResult.adminTab) {
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('hs_admin_navigate', { detail: { tab: actionResult.adminTab } }));
                    }, delay);
                } else if (actionResult.navigateTo) {
                    setTimeout(() => navigate(actionResult.navigateTo!), delay);
                }

                setIsLoading(false);
                return; // Don't call the AI for pure action intents
            }

            // ── STEP 2: No action matched → ask the AI ────────────────────────
            let botAnswer: string | null = null;
            let toolResults: any[] = [];

            // Try authenticated endpoint first
            if (token) {
                try {
                    const response = await fetch(`${API_BASE}/api/chat/send`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ message: messageToSend, chatId: currentChatId })
                    });
                    const data = await response.json();
                    if (response.ok && data.success) {
                        if (!currentChatId && data.chatId) setCurrentChatId(data.chatId);
                        botAnswer = data.botResponse;
                        toolResults = data.toolResults || [];
                    }
                    if (response.status === 401) localStorage.removeItem('hs_auth_token');
                } catch (_) { /* network error, fall through */ }
            }

            // Fallback: public QA endpoint
            if (!botAnswer) {
                try {
                    const response = await fetch(`${API_BASE}/api/qa/query`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ question: messageToSend })
                    });
                    const data = await response.json();
                    if (data.lock) setIsLocked(true);
                    if (data.success) botAnswer = data.answer;
                } catch (_) { /* network error */ }
            }

            // ── STEP 3: Check if AI response contains a navigation tool result ─
            if (toolResults && toolResults.length > 0) {
                toolResults.forEach(tr => {
                    if (tr.result?.type === 'ui_action' && tr.result?.action === 'navigate') {
                        const target = (tr.result.target || '').toLowerCase();
                        if (isAdmin) {
                            const adminTabMap: Record<string, string> = {
                                'dashboard': 'dashboard', 'users': 'users',
                                'analytics': 'analytics', 'reports': 'analytics',
                                'history': 'history', 'notifications': 'notifications',
                                'settings': 'settings'
                            };
                            const tab = adminTabMap[target];
                            if (tab) setTimeout(() => window.dispatchEvent(new CustomEvent('hs_admin_navigate', { detail: { tab } })), 1500);
                        } else {
                            const pathMap: Record<string, string> = {
                                'dashboard': '/dashboard?tab=dashboard',
                                'reports': '/dashboard?tab=reports',
                                'settings': '/dashboard?tab=settings',
                                'scans': '/dashboard?tab=history',
                                'history': '/dashboard?tab=history',
                                'subscription': '/dashboard?tab=plans',
                                'plans': '/dashboard?tab=plans',
                                'help': '/dashboard?tab=help'
                            };
                            if (pathMap[target]) setTimeout(() => navigate(pathMap[target]), 1500);
                        }
                    }
                });
            }

            // Clean up AI tags and display response
            const cleanAnswer = botAnswer
                ? botAnswer
                    .replace(/<think>[\s\S]*?<\/think>/gi, '') // Remove reasoning blocks
                    .replace(/\[TOOL_CALL:\s*[\s\S]*?\]/g, '') // Remove tool tags
                    .trim()
                : null;

            addBotMessage(cleanAnswer || "I'm having trouble responding right now. Please try again.");

        } catch (error) {
            console.error('Chatbot error:', error);
            addBotMessage("Sorry, I can't connect to the server right now. Please ensure the backend is running or email contact@hacksentinel.com");
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Hide the chatbot entirely on public pages when the visitor is not signed in.
    if (!isAuthed) return null;

    return (
        <div className={`chatbot-container ${position}`}>
            {/* Chat Window */}
            {isOpen && (
                <div className="chatbot-window">
                    {/* Header */}
                    <div className="chatbot-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                                width: '40px', height: '40px',
                                background: 'rgba(255,255,255,0.2)',
                                borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <i className="bi bi-robot" style={{ fontSize: '1.5rem' }}></i>
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>HackSentinel Assistant</h4>
                                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.9 }}>Navigate • Scan • Assist</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: 'rgba(255,255,255,0.2)', border: 'none',
                                borderRadius: '50%', width: '32px', height: '32px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', color: 'white', fontSize: '1.2rem',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        >
                            <i className="bi bi-x"></i>
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="chatbot-messages">
                        {messages.map((msg, index) => (
                            <div key={index} className={`message ${msg.sender}`}>
                                <div className="message-content" style={{ whiteSpace: 'pre-line' }}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="message bot">
                                <div className="message-content ai-thinking-container">
                                    <span className="ai-thinking-text">HackSentinel AI is thinking...</span>
                                    <div className="chat-progress-bar">
                                        <div className="chat-progress-fill"></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Questions */}
                    {messages.length <= 1 && (
                        <div className="quick-questions">
                            {quickQuestions.map((question, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSendMessage(question)}
                                    className="quick-btn"
                                >
                                    {question}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="chatbot-input">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={isLocked ? "Chat is locked." : "Type a message or command..."}
                            disabled={isLoading || isLocked}
                            style={{ cursor: isLocked ? 'not-allowed' : 'text' }}
                        />
                        <button
                            onClick={() => handleSendMessage()}
                            disabled={!inputMessage.trim() || isLoading || isLocked}
                            className="send-btn"
                        >
                            <i className="bi bi-send-fill"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="chatbot-toggle"
                style={{
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    animation: 'pulse 2s infinite'
                }}
            >
                <i className={`bi ${isOpen ? 'bi-x' : 'bi-chat-dots-fill'}`}></i>
            </button>
        </div>
    );
};

export default Chatbot;
