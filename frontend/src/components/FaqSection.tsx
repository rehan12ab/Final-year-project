import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ArrowRight } from 'lucide-react';

const faqs = [
    {
        question: 'What does HackSentinel actually detect?',
        answer: 'The passive engine checks TLS configuration, security headers (CSP, HSTS, X-Frame-Options), WAF/CDN presence, exposed ports, and scans your JavaScript bundle for leaked secrets (API keys, JWTs, AWS credentials). The active engine adds AI-verified probes for OWASP Top 10 categories — XSS, SQLi, SSRF, IDOR, CSRF, and common misconfigurations.'
    },
    {
        question: 'Will scans disrupt my production site?',
        answer: 'No. Payloads are non-destructive by default — they test for vulnerability presence without mutating data or triggering side effects. Destructive tests require an explicit opt-in per scan.'
    },
    {
        question: 'How is this different from ZAP or Nikto?',
        answer: 'Open-source scanners return everything they see and let you triage. HackSentinel verifies each candidate finding with an AI reasoning layer before it reaches your dashboard, so what you see is what you should actually fix.'
    },
    {
        question: 'Is there a free tier?',
        answer: 'Yes. The Free plan includes passive scans, the AI chatbot, and PDF export. Upgrade to Professional for AI-verified active scans and unlimited targets, or Enterprise for team seats and custom SLAs.'
    },
    {
        question: 'How does pricing work?',
        answer: 'Three tiers: Free ($0), Professional (monthly), and Enterprise (custom quote). Change, cancel, or downgrade any time from your Plans tab — no hidden fees. See the Pricing page for the current numbers.'
    },
    {
        question: 'Where is my data stored?',
        answer: 'Scan results are tied to your account and stored in our managed MongoDB. You can delete any scan or your entire account from the dashboard. Nothing is shared with third parties.'
    },
    {
        question: 'Can I export findings for HackerOne / Bugcrowd?',
        answer: 'Yes. Every scan can be exported as PDF or DOCX with reproduction steps, evidence, CVSS score, and remediation guidance — formatted for direct submission to bug bounty platforms.'
    },
    {
        question: 'Is CI/CD integration available?',
        answer: 'GitHub Actions and GitLab CI integration is on the roadmap. Today, you can trigger scans from the dashboard or via the REST API — a public API reference is coming with the CI/CD release.'
    }
];

const FaqSection: React.FC = () => {
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    return (
        <section className="faq-section">
            <div className="container">
                <div className="faq-layout">
                    <div className="faq-header-col">
                        <div className="glow-badge">FAQ</div>
                        <h2 className="section-title">Everything You Need to Know</h2>
                        <p className="section-subtitle" style={{ marginTop: '1rem' }}>
                            Questions about scanning safety, pricing, or how findings are verified? Answers below.
                        </p>
                        <Link to="/contact" className="faq-contact-link">
                            <span>Still have questions? Contact us</span>
                            <ArrowRight size={16} />
                        </Link>
                    </div>

                    <div className="faq-accordion">
                        {faqs.map((faq, idx) => (
                            <div
                                key={idx}
                                className={`faq-item ${openFaq === idx ? 'open' : ''}`}
                            >
                                <button
                                    className="faq-question"
                                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                    aria-expanded={openFaq === idx}
                                >
                                    <span>{faq.question}</span>
                                    <ChevronDown size={20} className="faq-chevron" />
                                </button>
                                <div className="faq-answer-wrap">
                                    <div className="faq-answer">
                                        <p>{faq.answer}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default FaqSection;
