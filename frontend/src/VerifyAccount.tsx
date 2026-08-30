import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './VerifyAccount.css';
import Navbar from './components/Navbar';
import Popup from './components/Popup';
import { FaCheckCircle, FaKey } from 'react-icons/fa';
import { MdEmail } from 'react-icons/md';

const VerifyAccount: React.FC = () => {
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email') || '';
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

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

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!code || code.length !== 6) {
            setPopup({
                isOpen: true,
                title: "Invalid Code",
                message: "Please enter a valid 6-digit verification code.",
                type: "error"
            });
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("http://localhost:5000/api/auth/verify-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code }),
            });

            const data = await response.json();

            if (response.ok) {
                setPopup({
                    isOpen: true,
                    title: "Verification Successful!",
                    message: "Your account has been verified. Redirecting to dashboard...",
                    type: "success"
                });

                setTimeout(() => {
                    navigate("/dashboard");
                }, 2000);
            } else {
                setPopup({
                    isOpen: true,
                    title: "Verification Failed",
                    message: data.message || "Invalid or expired code. Please try again.",
                    type: "error"
                });
            }
        } catch (err) {
            setPopup({
                isOpen: true,
                title: "Connection Error",
                message: "Could not connect to the server. Please try again later.",
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

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

            <div className="verify-content">
                <div className="verify-card">
                    <div className="verify-icon" style={{ padding: '12px' }}>
                        <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>

                    <h1 className="verify-title">Verify Your Account</h1>
                    <p className="verify-subtitle">
                        We've sent a 6-digit verification code to:
                    </p>

                    <div className="email-display">
                        <MdEmail />
                        <span>{email}</span>
                    </div>

                    <form onSubmit={handleVerify} className="verify-form">
                        <div className="code-input-group">
                            <FaKey className="input-icon" />
                            <input
                                type="text"
                                placeholder="Enter 6-digit code"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                maxLength={6}
                                className="code-input"
                                required
                            />
                        </div>

                        <button type="submit" className="verify-btn" disabled={loading}>
                            {loading ? "Verifying..." : "Verify Account"}
                        </button>
                    </form>

                    <div className="verify-footer">
                        <p>Didn't receive the code?</p>
                        <button className="resend-link" onClick={() => {
                            setPopup({
                                isOpen: true,
                                title: "Coming Soon",
                                message: "Code resend functionality will be available soon.",
                                type: "info"
                            });
                        }}>
                            Resend Code
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyAccount;
