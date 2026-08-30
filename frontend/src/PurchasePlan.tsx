import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Popup from "./components/Popup";
import SessionManager from "./utils/sessionManager";
import { BsCreditCard2Front, BsArrowLeft, BsShieldCheck } from "react-icons/bs";
import { ShieldCheck, Lock, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import "./VerifyAccount.css";

interface PlanDetails {
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: string;
    features: string[];
}

const PurchasePlan: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const planData = location.state as PlanDetails;

    const [loading, setLoading] = useState(false);
    const [paymentData, setPaymentData] = useState({
        cardHolderName: "",
        cardNumber: "",
        expiryDate: "",
        cvv: ""
    });

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

    useEffect(() => {
        if (!planData) {
            navigate("/dashboard");
        }
    }, [planData, navigate]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        if (name === "cardNumber") {
            const digitsOnly = value.replace(/\D/g, '').slice(0, 16);
            setPaymentData(prev => ({ ...prev, cardNumber: digitsOnly }));
        } else if (name === "expiryDate") {
            let digitsOnly = value.replace(/\D/g, '');
            if (digitsOnly.length >= 2) {
                digitsOnly = digitsOnly.slice(0, 2) + '/' + digitsOnly.slice(2, 4);
            }
            setPaymentData(prev => ({ ...prev, expiryDate: digitsOnly.slice(0, 5) }));
        } else if (name === "cvv") {
            const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
            setPaymentData(prev => ({ ...prev, cvv: digitsOnly }));
        } else {
            setPaymentData(prev => ({ ...prev, [name]: value }));
        }
    };

    const detectCardType = (number: string): string => {
        if (number.startsWith('4')) return 'Visa';
        if (number.startsWith('5')) return 'Mastercard';
        if (number.startsWith('3')) return 'Amex';
        return 'Card';
    };

    const formatCardNumber = (num: string) => {
        if (!num) return '•••• •••• •••• ••••';
        const padded = num.padEnd(16, '•');
        return `${padded.slice(0, 4)} ${padded.slice(4, 8)} ${padded.slice(8, 12)} ${padded.slice(12, 16)}`;
    };

    const handlePurchase = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!paymentData.cardHolderName || !paymentData.cardNumber || !paymentData.expiryDate || !paymentData.cvv) {
            setPopup({
                isOpen: true,
                title: "Missing Information",
                message: "Please fill all payment details",
                type: "error"
            });
            return;
        }

        if (paymentData.cardNumber.length < 13) {
            setPopup({
                isOpen: true,
                title: "Invalid Card",
                message: "Please enter a valid card number",
                type: "error"
            });
            return;
        }

        setLoading(true);

        try {
            const token = SessionManager.getInstance().getToken() || localStorage.getItem("hs_auth_token");

            const response = await fetch("http://localhost:5000/api/subscription/purchase", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    planId: planData.id,
                    paymentMethod: {
                        cardHolderName: paymentData.cardHolderName,
                        cardNumberLast4: paymentData.cardNumber.slice(-4),
                        expiryDate: paymentData.expiryDate,
                        cardType: detectCardType(paymentData.cardNumber)
                    }
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setPopup({
                    isOpen: true,
                    title: "Purchase Failed",
                    message: data?.message || "Could not process purchase",
                    type: "error"
                });
                return;
            }

            setPopup({
                isOpen: true,
                title: "Subscription Activated! 🎉",
                message: `Successfully upgraded to ${planData.name} plan. Redirecting to dashboard...`,
                type: "success"
            });

            setTimeout(() => {
                navigate("/dashboard");
            }, 2000);

        } catch (error) {
            console.error("Purchase error:", error);
            setPopup({
                isOpen: true,
                title: "Connection Error",
                message: "Could not connect to server. Please try again.",
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    if (!planData) return null;

    return (
        <div className="verify-account-page">
            <Navbar />
            <Popup
                isOpen={popup.isOpen}
                onClose={() => setPopup({ ...popup, isOpen: false })}
                title={popup.title}
                message={popup.message}
                type={popup.type}
            />

            <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '980px', margin: '0 auto' }}>
                <button
                    onClick={() => navigate("/dashboard")}
                    className="back-btn-pill"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: 'var(--radius-full)',
                        padding: '0.6rem 1.25rem',
                        color: '#475569',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        marginBottom: '1.5rem',
                        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)'
                    }}
                >
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem', alignItems: 'start' }}>
                    {/* Left Column: Virtual Credit Card & Plan Summary */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Interactive Credit Card Preview */}
                        <div style={{
                            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4f46e5 100%)',
                            borderRadius: '20px',
                            padding: '1.75rem',
                            color: 'white',
                            boxShadow: '0 16px 36px -4px rgba(79, 70, 229, 0.45)',
                            position: 'relative',
                            overflow: 'hidden',
                            minHeight: '200px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{
                                    width: '40px',
                                    height: '28px',
                                    background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                                    borderRadius: '6px'
                                }}></div>
                                <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.05em' }}>
                                    {detectCardType(paymentData.cardNumber)}
                                </span>
                            </div>

                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '1.25rem',
                                letterSpacing: '0.15em',
                                margin: '1rem 0'
                            }}>
                                {formatCardNumber(paymentData.cardNumber)}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', display: 'block' }}>Card Holder</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase' }}>
                                        {paymentData.cardHolderName || 'YOUR NAME'}
                                    </span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', display: 'block' }}>Expires</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                        {paymentData.expiryDate || 'MM/YY'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Plan Summary Card */}
                        <div className="glass-card" style={{ padding: '1.75rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>Selected Tier</span>
                            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>{planData.name}</h2>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#4f46e5' }}>${planData.price}</span>
                                <span style={{ color: '#64748b', fontWeight: 600 }}>/ {planData.interval}</span>
                            </div>

                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {planData.features.map((feature, idx) => (
                                    <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', color: '#334155' }}>
                                        <CheckCircle2 size={16} color="#10b981" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Right Column: Checkout Payment Form */}
                    <div className="glass-card" style={{ padding: '2.5rem' }}>
                        <div style={{ marginBottom: '1.75rem' }}>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Payment Information</h2>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.2rem 0 0' }}>Enter your payment details to complete subscription</p>
                        </div>

                        <form onSubmit={handlePurchase} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="form-group-modern">
                                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Cardholder Full Name</label>
                                <input
                                    type="text"
                                    name="cardHolderName"
                                    placeholder="Jane Doe"
                                    value={paymentData.cardHolderName}
                                    onChange={handleInputChange}
                                    className="form-input-modern"
                                    required
                                />
                            </div>

                            <div className="form-group-modern">
                                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Card Number</label>
                                <input
                                    type="text"
                                    name="cardNumber"
                                    placeholder="4000 1234 5678 9010"
                                    value={paymentData.cardNumber}
                                    onChange={handleInputChange}
                                    className="form-input-modern"
                                    maxLength={16}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group-modern">
                                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Expiry (MM/YY)</label>
                                    <input
                                        type="text"
                                        name="expiryDate"
                                        placeholder="12/28"
                                        value={paymentData.expiryDate}
                                        onChange={handleInputChange}
                                        className="form-input-modern"
                                        maxLength={5}
                                        required
                                    />
                                </div>

                                <div className="form-group-modern">
                                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Security CVV</label>
                                    <input
                                        type="password"
                                        name="cvv"
                                        placeholder="•••"
                                        value={paymentData.cvv}
                                        onChange={handleInputChange}
                                        className="form-input-modern"
                                        maxLength={4}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="verify-btn shimmer-hover"
                                disabled={loading}
                                style={{ marginTop: '0.5rem' }}
                            >
                                {loading ? "Authorizing Payment..." : `Activate ${planData.name} Plan • $${planData.price}`}
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.82rem', marginTop: '0.5rem' }}>
                                <Lock size={14} color="#10b981" />
                                <span>256-Bit TLS Encrypted Checkout • Cancel anytime</span>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchasePlan;
