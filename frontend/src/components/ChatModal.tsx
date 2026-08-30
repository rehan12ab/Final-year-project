import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ChatModal.css';

interface Message {
    sender: 'user' | 'bot' | 'admin';
    content: string;
    timestamp: Date;
    read?: boolean;
}

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    chatId?: string | null;
}

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, chatId }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentChatId, setCurrentChatId] = useState<string | null>(chatId || null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // When the modal opens or the target chatId prop changes, load that chat's history.
    // We use the prop directly (not the internal state) so that opening a different chat
    // after closing always fetches the correct conversation — even if the previous
    // handleClose() reset currentChatId to null.
    useEffect(() => {
        if (!isOpen) return;
        if (chatId) {
            setCurrentChatId(chatId);
            loadChatHistory(chatId);
        } else {
            setCurrentChatId(null);
            setMessages([{
                sender: 'bot',
                content: "Hello! Welcome to HackSentinel Live Chat. How can I assist you today?",
                timestamp: new Date()
            }]);
        }
    }, [isOpen, chatId]);

    const loadChatHistory = async (idToLoad?: string) => {
        const resolvedId = idToLoad || currentChatId;
        if (!resolvedId) return;

        const token = localStorage.getItem('hs_auth_token');
        if (!token) return;

        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:5000"}/api/chat/history/${resolvedId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            if (data.success && data.chat) {
                setMessages(data.chat.messages.map((msg: any) => ({
                    sender: msg.sender,
                    content: msg.content.replace(/\[TOOL_CALL:\s*[\s\S]*?\]/g, '').trim(),
                    timestamp: new Date(msg.timestamp)
                })));
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    };

    const handleSendMessage = async () => {
        const messageToSend = inputMessage.trim();
        if (!messageToSend) return;

        const token = localStorage.getItem('hs_auth_token');
        if (!token) {
            alert('Please sign in to use live chat');
            return;
        }

        // Add user message optimistically
        const userMessage: Message = {
            sender: 'user',
            content: messageToSend,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            let botAnswer: string | null = null;
            let toolResults: any[] = [];

            // Try authenticated endpoint (saves history)
            try {
                const response = await fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:5000"}/api/chat/send`, {
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
            } catch (_) { /* fall through */ }

            // Fallback: public QA endpoint
            if (!botAnswer) {
                const res = await fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:5000"}/api/qa/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question: messageToSend })
                });
                const d = await res.json();
                if (d.success) botAnswer = d.answer;
            }

            // Handle UI Actions from Tools
            if (toolResults && toolResults.length > 0) {
                console.log('[Frontend Agent] Received Tool Results:', toolResults);
                toolResults.forEach(tr => {
                    if (tr.result && tr.result.type === 'ui_action') {
                        console.log('[Frontend Agent] Executing UI Action:', tr.result.action, tr.result.target);
                        if (tr.result.action === 'navigate') {
                            const target = tr.result.target.toLowerCase();
                            const pathMap: Record<string, string> = {
                                'dashboard': '/dashboard?tab=dashboard',
                                'reports': '/dashboard?tab=reports',
                                'settings': '/dashboard?tab=settings',
                                'scans': '/dashboard?tab=history',
                                'subscription': '/dashboard?tab=plans',
                                'help': '/dashboard?tab=help'
                            };
                            if (pathMap[target]) {
                                setTimeout(() => navigate(pathMap[target]), 1500);
                            }
                        }
                    }
                });
            }

            // Clean up the bot answer (hide the TOOL_CALL tag)
            const cleanAnswer = botAnswer ? botAnswer.replace(/\[TOOL_CALL:\s*[\s\S]*?\]/g, '').trim() : null;

            setMessages(prev => [...prev, {
                sender: 'bot',
                content: cleanAnswer || "I'm having trouble responding right now. Please try again.",
                timestamp: new Date()
            }]);
        } catch (error) {
            console.error('Chat send error:', error);
            setMessages(prev => [...prev, {
                sender: 'bot',
                content: "Sorry, I can't connect right now. Please ensure the backend is running or email contact@hacksentinel.com",
                timestamp: new Date()
            }]);
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

    const handleClose = () => {
        setMessages([]);
        setCurrentChatId(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="chat-modal-overlay">
            <div className="chat-modal-container">
                {/* Header */}
                <div className="chat-modal-header">
                    <div className="chat-modal-header-info">
                        <div className="chat-modal-avatar">
                            <i className="bi bi-chat-dots-fill"></i>
                        </div>
                        <div>
                            <h3 className="chat-modal-title">Live Chat Support</h3>
                            <p className="chat-modal-status">
                                <span className="chat-modal-status-dot"></span>
                                Online - We're here to help
                            </p>
                        </div>
                    </div>
                    <button className="chat-modal-close" onClick={handleClose}>
                        <i className="bi bi-x"></i>
                    </button>
                </div>

                {/* Messages */}
                <div className="chat-modal-messages">
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`chat-message ${msg.sender === 'user' ? 'user' : 'bot'}`}
                        >
                            {msg.sender !== 'user' && (
                                <div className="chat-message-avatar">
                                    <i className="bi bi-robot"></i>
                                </div>
                            )}
                            <div className="chat-message-wrapper">
                                <div className="chat-message-bubble">
                                    {msg.content}
                                </div>
                                <span className="chat-message-time">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="chat-typing-indicator">
                            <div className="chat-message-avatar">
                                <i className="bi bi-robot"></i>
                            </div>
                            <div className="chat-message-wrapper">
                                <div className="chat-ai-thinking">
                                    <span>HackSentinel AI is thinking...</span>
                                    <div className="chat-progress-bar">
                                        <div className="chat-progress-fill"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="chat-modal-input">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message here..."
                        disabled={isLoading}
                    />
                    <button
                        className="chat-modal-send"
                        onClick={handleSendMessage}
                        disabled={!inputMessage.trim() || isLoading}
                    >
                        <i className="bi bi-send-fill"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatModal;
