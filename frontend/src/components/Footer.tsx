import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';
import { Shield, Github, Twitter, Linkedin, Send, CheckCircle2 } from 'lucide-react';

const Footer: React.FC = () => {
    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);

    const handleSubscribe = (e: React.FormEvent) => {
        e.preventDefault();
        if (email.trim()) {
            setSubscribed(true);
            setTimeout(() => {
                setSubscribed(false);
                setEmail('');
            }, 4000);
        }
    };

    return (
        <footer className="footer">
            <div className="footer-container">
                {/* Top Section: Brand & Newsletter */}
                <div className="footer-top-grid">
                    <div className="footer-brand-col">
                        <Link to="/" className="footer-logo-link">
                            <div className="footer-logo-box">
                                <img src="/logo.png" alt="HackSentinel Logo" className="footer-logo-img" />
                            </div>
                            <span className="footer-logo-text">Hack<span>Sentinel</span></span>
                        </Link>
                        <p className="footer-brand-desc">
                            Next-generation AI vulnerability intelligence and automated penetration testing platform. Defending modern cloud infrastructure and web applications 24/7.
                        </p>
                        <div className="footer-socials">
                            <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub" className="social-btn">
                                <Github size={18} />
                            </a>
                            <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter" className="social-btn">
                                <Twitter size={18} />
                            </a>
                            <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn" className="social-btn">
                                <Linkedin size={18} />
                            </a>
                        </div>
                    </div>

                    <div className="footer-newsletter-col">
                        <h4 className="newsletter-title">Stay Ahead of Cyber Threats</h4>
                        <p className="newsletter-desc">Subscribe to our weekly intelligence briefings on emerging vulnerabilities & CVE updates.</p>
                        {subscribed ? (
                            <div className="newsletter-success">
                                <CheckCircle2 size={18} />
                                <span>Thank you for subscribing to HackSentinel Intelligence!</span>
                            </div>
                        ) : (
                            <form onSubmit={handleSubscribe} className="newsletter-form">
                                <input
                                    type="email"
                                    placeholder="Enter your work email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="newsletter-input"
                                />
                                <button type="submit" className="newsletter-btn shimmer-hover">
                                    <span>Subscribe</span>
                                    <Send size={15} />
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                <div className="footer-divider" />

                {/* Navigation Links Grid */}
                <div className="footer-links-grid">
                    <div className="footer-column">
                        <h4 className="footer-column-title">Platform</h4>
                        <ul className="footer-links">
                            <li><Link to="/">Overview</Link></li>
                            <li><Link to="/features">Vulnerability Engine</Link></li>
                            <li><Link to="/services">AI Pen-Testing</Link></li>
                            <li><Link to="/pricing">Pricing & Tiers</Link></li>
                        </ul>
                    </div>

                    <div className="footer-column">
                        <h4 className="footer-column-title">Solutions</h4>
                        <ul className="footer-links">
                            <li><Link to="/services">OWASP Top 10 Audit</Link></li>
                            <li><Link to="/services">API Security Scanner</Link></li>
                            <li><Link to="/services">Continuous CI/CD Guard</Link></li>
                            <li><Link to="/services">Automated Executive Reports</Link></li>
                        </ul>
                    </div>

                    <div className="footer-column">
                        <h4 className="footer-column-title">Company</h4>
                        <ul className="footer-links">
                            <li><Link to="/about">About Us</Link></li>
                            <li><Link to="/contact">Contact Support</Link></li>
                            <li><Link to="/signin">Customer Portal</Link></li>
                            <li><Link to="/signup">Start Free Trial</Link></li>
                        </ul>
                    </div>

                    <div className="footer-column">
                        <h4 className="footer-column-title">Security & Trust</h4>
                        <ul className="footer-links">
                            <li><span className="status-badge"><span className="status-dot"></span> All Systems Operational</span></li>
                            <li><span>SOC 2 Type II Certified</span></li>
                            <li><span>GDPR & HIPAA Compliant</span></li>
                            <li><span>256-bit TLS Encryption</span></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="footer-bottom">
                    <p className="footer-copyright">
                        © {new Date().getFullYear()} HackSentinel Security Inc. All rights reserved.
                    </p>
                    <div className="footer-bottom-links">
                        <a href="#privacy">Privacy Policy</a>
                        <span className="separator">•</span>
                        <a href="#terms">Terms of Service</a>
                        <span className="separator">•</span>
                        <a href="#security">Security Statement</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
