import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Sparkles, Zap, Building2 } from 'lucide-react';
import './PricingPreview.css';

const tiers = [
    {
        name: 'Free',
        price: '$0',
        cadence: 'forever',
        icon: Sparkles,
        colorClass: 'indigo',
        blurb: 'Get started with passive recon and the AI assistant.',
        features: [
            'Passive scans (TLS, headers, WAF)',
            'JS secret scanner',
            'AI security chatbot',
            'PDF report export',
            '3 targets / month'
        ],
        cta: 'Start Free',
        featured: false
    },
    {
        name: 'Professional',
        price: '$29',
        cadence: 'per month',
        icon: Zap,
        colorClass: 'cyan',
        blurb: 'AI-verified active scans for serious users.',
        features: [
            'Everything in Free',
            'AI-verified active scans',
            'OWASP Top 10 coverage',
            'Unlimited targets',
            'DOCX + HackerOne export',
            'Priority scan queue'
        ],
        cta: 'Go Professional',
        featured: true
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        cadence: 'talk to us',
        icon: Building2,
        colorClass: 'violet',
        blurb: 'Team seats, SSO, and dedicated support.',
        features: [
            'Everything in Professional',
            'Team seats + role controls',
            'SSO (SAML / OIDC)',
            'Dedicated scan infrastructure',
            'SLA & priority support',
            'Custom compliance templates'
        ],
        cta: 'Contact Sales',
        featured: false
    }
];

const PricingPreview: React.FC = () => {
    return (
        <section className="pricing-preview-section">
            <div className="container">
                <div className="section-header text-center">
                    <div className="glow-badge">Pricing</div>
                    <h2 className="section-title">Simple plans, <span className="text-gradient">honest pricing</span></h2>
                    <p className="section-subtitle">Start free. Upgrade when you need AI-verified active scanning.</p>
                </div>

                <div className="pricing-preview-grid">
                    {tiers.map((tier) => {
                        const Icon = tier.icon;
                        return (
                            <div
                                key={tier.name}
                                className={`pricing-preview-card glass-card ${tier.featured ? 'featured' : ''}`}
                            >
                                {tier.featured && <div className="pricing-preview-badge">Most Popular</div>}
                                <div className={`pricing-preview-icon ${tier.colorClass}`}>
                                    <Icon size={26} />
                                </div>
                                <h3 className="pricing-preview-name">{tier.name}</h3>
                                <div className="pricing-preview-price">
                                    <span className="price-value">{tier.price}</span>
                                    <span className="price-cadence">{tier.cadence}</span>
                                </div>
                                <p className="pricing-preview-blurb">{tier.blurb}</p>
                                <ul className="pricing-preview-features">
                                    {tier.features.map((f, i) => (
                                        <li key={i}>
                                            <CheckCircle2 size={16} className="feature-tick" />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    to={tier.name === 'Enterprise' ? '/contact' : '/signup'}
                                    className={tier.featured ? 'btn-primary-lg' : 'btn-secondary-lg'}
                                    style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}
                                >
                                    <span>{tier.cta}</span>
                                    <ArrowRight size={16} />
                                </Link>
                            </div>
                        );
                    })}
                </div>

                <div className="pricing-preview-footnote">
                    <Link to="/pricing" className="faq-contact-link">
                        <span>See full plan comparison</span>
                        <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        </section>
    );
};

export default PricingPreview;
