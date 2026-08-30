import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import './Pricing.css';
import { Check, Sparkles, Zap, Shield, ArrowRight, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Pricing: React.FC = () => {
    const [isAnnual, setIsAnnual] = useState(false);

    const plans = [
        {
            name: 'Starter',
            monthlyPrice: 29,
            annualPrice: 23,
            description: 'Essential vulnerability scanning and security health checks for early-stage teams.',
            icon: Zap,
            colorClass: 'cyan',
            features: [
                '5 Target Projects / Domains',
                'OWASP Top 10 Automated Scans',
                'SSL / TLS Handshake Inspector',
                'Weekly Vulnerability Digest',
                '1 Developer Seat',
                'Email Support & Knowledge Base'
            ],
            cta: 'Start Free Trial',
            popular: false
        },
        {
            name: 'Professional',
            monthlyPrice: 99,
            annualPrice: 79,
            description: 'Advanced dual-layer AI exploit verification and continuous CI/CD pipeline defense.',
            icon: Sparkles,
            colorClass: 'indigo',
            features: [
                '25 Target Projects / Domains',
                'Multi-Model AI Payload Verification',
                'Deep Secret & Exposed Path Probe',
                'Automated PDF & DOCX Bug Reports',
                'CI/CD Pull Request Security Gates',
                '5 Developer Seats',
                'Priority 24/7 Support & AI Chatbot',
                'API & Webhook Integrations'
            ],
            cta: 'Start 14-Day Free Trial',
            popular: true
        },
        {
            name: 'Enterprise',
            monthlyPrice: null,
            annualPrice: null,
            customPrice: 'Custom',
            description: 'Dedicated security posture management, custom SLA, and on-premise scan engines.',
            icon: Shield,
            colorClass: 'violet',
            features: [
                'Unlimited Target Projects',
                'Custom AI Agent Fine-Tuning',
                'Dedicated Account Security Architect',
                'SOC 2 / HIPAA Compliance Audits',
                'Unlimited Developer Seats',
                'Self-Hosted Private Scan Agents',
                'Custom SLA & Guaranteed Uptime',
                'Direct Slack / Teams Incident Channel'
            ],
            cta: 'Contact Enterprise Sales',
            popular: false
        }
    ];

    return (
        <div className="pricing-page">
            <Navbar />

            {/* Pricing Header */}
            <section className="pricing-hero">
                <div className="container">
                    <div className="pricing-hero-content">
                        <div className="glow-badge">Transparent Pricing</div>
                        <h1 className="hero-title">
                            Simple, Predictable Plans for <span className="text-gradient">Every Scale</span>
                        </h1>
                        <p className="hero-subtitle">
                            Protect your web applications with enterprise-grade autonomous AI security. No hidden setup fees, cancel anytime.
                        </p>

                        {/* Billing Interval Toggle */}
                        <div className="billing-toggle-wrap">
                            <span className={`toggle-label ${!isAnnual ? 'active' : ''}`}>Monthly</span>
                            <button
                                className={`billing-switch ${isAnnual ? 'annual' : ''}`}
                                onClick={() => setIsAnnual(!isAnnual)}
                                aria-label="Toggle annual or monthly billing"
                            >
                                <span className="switch-knob"></span>
                            </button>
                            <span className={`toggle-label ${isAnnual ? 'active' : ''}`}>
                                Annual <span className="discount-pill">Save 20%</span>
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Cards Grid */}
            <section className="pricing-grid-section">
                <div className="container">
                    <div className="pricing-grid">
                        {plans.map((plan, index) => {
                            const IconComponent = plan.icon;
                            const displayPrice = plan.customPrice
                                ? plan.customPrice
                                : isAnnual
                                    ? `$${plan.annualPrice}`
                                    : `$${plan.monthlyPrice}`;

                            return (
                                <div
                                    key={index}
                                    className={`pricing-card glass-card ${plan.popular ? 'popular' : ''}`}
                                >
                                    {plan.popular && (
                                        <div className="popular-ribbon">
                                            <Sparkles size={14} /> Most Popular
                                        </div>
                                    )}

                                    <div className="plan-card-header">
                                        <div className={`plan-icon-halo ${plan.colorClass}`}>
                                            <IconComponent size={26} />
                                        </div>
                                        <h3 className="plan-name">{plan.name}</h3>
                                        <p className="plan-desc">{plan.description}</p>
                                    </div>

                                    <div className="plan-price-wrap">
                                        <div className="price-amount-row">
                                            <span className="price-amount">{displayPrice}</span>
                                            {!plan.customPrice && (
                                                <span className="price-period">/ month</span>
                                            )}
                                        </div>
                                        {!plan.customPrice && isAnnual && (
                                            <span className="billed-annually-note">Billed annually (${plan.annualPrice! * 12}/yr)</span>
                                        )}
                                    </div>

                                    <div className="plan-divider"></div>

                                    <div className="plan-features-wrap">
                                        <span className="features-header-title">Included capabilities:</span>
                                        <ul className="plan-features-list">
                                            {plan.features.map((feature, fIdx) => (
                                                <li key={fIdx} className="feature-line">
                                                    <Check size={16} className="feature-check-icon" />
                                                    <span>{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <Link
                                        to={plan.name === 'Enterprise' ? '/contact' : '/signup'}
                                        className={`plan-cta-btn shimmer-hover ${plan.popular ? 'primary' : 'secondary'}`}
                                    >
                                        <span>{plan.cta}</span>
                                        <ArrowRight size={16} />
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="pricing-faq-section">
                <div className="container">
                    <div className="section-header text-center">
                        <div className="glow-badge">Common Questions</div>
                        <h2 className="section-title">Frequently Asked Questions</h2>
                    </div>

                    <div className="faq-grid">
                        <div className="faq-card glass-card">
                            <h4>Can I test my website before paying?</h4>
                            <p>Yes, all new accounts start with full access to our free tier including automated vulnerability audits and PDF reporting.</p>
                        </div>
                        <div className="faq-card glass-card">
                            <h4>Will scans impact my live production servers?</h4>
                            <p>No. HackSentinel uses safe, non-destructive payload verification routines engineered to simulate attack behavior without disrupting data or uptime.</p>
                        </div>
                        <div className="faq-card glass-card">
                            <h4>Can I cancel or upgrade my subscription?</h4>
                            <p>You can upgrade, downgrade, or cancel your plan at any time directly from the customer billing dashboard with immediate effect.</p>
                        </div>
                        <div className="faq-card glass-card">
                            <h4>Do you offer custom enterprise deployment?</h4>
                            <p>Yes. For enterprise clients requiring dedicated on-premise scan runners or custom SLAs, contact our solutions architect team.</p>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
            <Chatbot position="bottom-right" />
        </div>
    );
};

export default Pricing;
