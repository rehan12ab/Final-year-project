import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import Popup from './components/Popup';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import './Contact.css';
import {
    Mail,
    Phone,
    MapPin,
    Send,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Copy,
    Check,
    Shield,
    MessageSquare
} from 'lucide-react';

const Contact: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
    });

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Popup State
    const [popup, setPopup] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info",
    });

    const handleCopy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setErrorMessage('');

        try {
            const token = localStorage.getItem('hs_auth_token');
            const endpoint = token
                ? `${import.meta.env.VITE_API_BASE || "http://localhost:5000"}/api/contact`
                : `${import.meta.env.VITE_API_BASE || "http://localhost:5000"}/api/contact/public`;

            const headers: any = {
                'Content-Type': 'application/json',
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to send message');
            }

            setStatus('success');
            setPopup({
                isOpen: true,
                title: "Message Dispatched! 🚀",
                message: "Thank you for reaching out. Our security team will review your inquiry and respond within 24 hours.",
                type: "success"
            });
            setFormData({
                name: '',
                email: '',
                phone: '',
                subject: '',
                message: ''
            });

            setTimeout(() => setStatus('idle'), 5000);

        } catch (error: any) {
            setStatus('error');
            setErrorMessage(error.message || 'Something went wrong. Please try again.');
            setPopup({
                isOpen: true,
                title: "Dispatch Failed",
                message: error.message || "Failed to send message. Please try again.",
                type: "error"
            });
        }
    };

    return (
        <div className="contact-page">
            <Navbar />
            <Popup
                isOpen={popup.isOpen}
                onClose={() => setPopup({ ...popup, isOpen: false })}
                title={popup.title}
                message={popup.message}
                type={popup.type}
            />

            {/* Header */}
            <section className="contact-hero">
                <div className="container">
                    <div className="contact-hero-content">
                        <div className="glow-badge">Security Helpdesk</div>
                        <h1 className="hero-title">
                            Get in Touch with Our <span className="text-gradient">Security Team</span>
                        </h1>
                        <p className="hero-subtitle">
                            Have questions about autonomous AI penetration testing, custom deployment, or bug bounty reporting? We're here to assist.
                        </p>
                    </div>
                </div>
            </section>

            {/* Contact Layout Content */}
            <section className="contact-main-section">
                <div className="container">
                    <div className="contact-layout-grid">
                        {/* Left Column: Direct Info Card */}
                        <div className="contact-info-panel glass-panel">
                            <div className="info-panel-header">
                                <h2>Direct Channels</h2>
                                <p>Click any item to copy contact details directly to your clipboard.</p>
                            </div>

                            <div className="contact-chips-list">
                                <div
                                    className="contact-chip-item"
                                    onClick={() => handleCopy('+1 (555) 321-4567', 'phone')}
                                    title="Click to copy phone number"
                                >
                                    <div className="chip-icon-box indigo"><Phone size={20} /></div>
                                    <div className="chip-text">
                                        <span className="chip-label">Direct Phone</span>
                                        <p className="chip-value">+1 (555) 321-4567</p>
                                    </div>
                                    <button type="button" className="copy-action-btn" aria-label="Copy Phone">
                                        {copiedField === 'phone' ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                                    </button>
                                </div>

                                <div
                                    className="contact-chip-item"
                                    onClick={() => handleCopy('security@hacksentinel.com', 'email')}
                                    title="Click to copy email"
                                >
                                    <div className="chip-icon-box cyan"><Mail size={20} /></div>
                                    <div className="chip-text">
                                        <span className="chip-label">Security Inquiries</span>
                                        <p className="chip-value">security@hacksentinel.com</p>
                                    </div>
                                    <button type="button" className="copy-action-btn" aria-label="Copy Email">
                                        {copiedField === 'email' ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                                    </button>
                                </div>

                                <div className="contact-chip-item">
                                    <div className="chip-icon-box violet"><MapPin size={20} /></div>
                                    <div className="chip-text">
                                        <span className="chip-label">Global Headquarters</span>
                                        <p className="chip-value">128 Cyber Defense Way, Suite 400, San Francisco, CA</p>
                                    </div>
                                </div>
                            </div>

                            <div className="contact-trust-pill">
                                <Shield size={20} className="trust-shield-icon" />
                                <div>
                                    <h4>Encrypted & Confidential</h4>
                                    <p>All inquiries are handled under strict NDA protocols with 256-bit encryption.</p>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Contact Form */}
                        <div className="contact-form-panel glass-card">
                            <h2 className="form-panel-title">Send a Message</h2>
                            <p className="form-panel-subtitle">Fill out the form below and an engineer will get back to you shortly.</p>

                            <form onSubmit={handleSubmit} className="modern-contact-form">
                                <div className="form-group-modern">
                                    <label htmlFor="name">Full Name</label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="Alex Mercer"
                                        className="form-input-modern"
                                        required
                                    />
                                </div>

                                <div className="form-row-modern">
                                    <div className="form-group-modern">
                                        <label htmlFor="email">Work Email</label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="alex@company.com"
                                            className="form-input-modern"
                                            required
                                        />
                                    </div>
                                    <div className="form-group-modern">
                                        <label htmlFor="phone">Phone (Optional)</label>
                                        <input
                                            type="tel"
                                            id="phone"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="+1 (555) 000-0000"
                                            className="form-input-modern"
                                        />
                                    </div>
                                </div>

                                <div className="form-group-modern">
                                    <label htmlFor="subject">Subject / Target Domain</label>
                                    <input
                                        type="text"
                                        id="subject"
                                        name="subject"
                                        value={formData.subject}
                                        onChange={handleChange}
                                        placeholder="Vulnerability audit inquiry / Custom SLA"
                                        className="form-input-modern"
                                        required
                                    />
                                </div>

                                <div className="form-group-modern">
                                    <label htmlFor="message">Message / Details</label>
                                    <textarea
                                        id="message"
                                        name="message"
                                        value={formData.message}
                                        onChange={handleChange}
                                        rows={4}
                                        placeholder="Tell us about your infrastructure, compliance requirements, or specific audit goals..."
                                        className="form-textarea-modern"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="contact-submit-btn shimmer-hover"
                                    disabled={status === 'loading'}
                                >
                                    {status === 'loading' ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            <span>Transmitting securely...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Send Message</span>
                                            <Send size={16} />
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
            <Chatbot position="bottom-right" />
        </div>
    );
};

export default Contact;
