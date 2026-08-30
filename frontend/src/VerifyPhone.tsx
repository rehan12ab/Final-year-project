import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from './firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import type { ConfirmationResult } from 'firebase/auth';
import './VerifyAccount.css';
import Navbar from './components/Navbar';
import Popup from './components/Popup';
import { FaKey, FaPhone } from 'react-icons/fa';
import { authApi } from "./services/api";

const VerifyPhone: React.FC = () => {
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email') || '';
    const phone = searchParams.get('phone') || '';
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
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

    useEffect(() => {
        if (!otpSent && phone) {
            setupRecaptcha();
        }

        // Cleanup function to properly remove reCAPTCHA verifier
        return () => {
            if ((window as any).recaptchaVerifier) {
                try {
                    (window as any).recaptchaVerifier.clear();
                } catch (error) {
                    console.error("Error clearing reCAPTCHA:", error);
                }
                (window as any).recaptchaVerifier = null;
            }
        };
    }, []);

    const setupRecaptcha = () => {
        try {
            // Clear existing verifier if it exists
            if ((window as any).recaptchaVerifier) {
                try {
                    (window as any).recaptchaVerifier.clear();
                } catch (error) {
                    console.error("Error clearing existing reCAPTCHA:", error);
                }
                (window as any).recaptchaVerifier = null;
            }

            // Ensure the container exists in DOM
            const container = document.getElementById('recaptcha-container');
            if (!container) {
                throw new Error("reCAPTCHA container not found");
            }

            // Create new verifier
            (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': () => {
                    // reCAPTCHA solved, allow signInWithPhoneNumber.
                    console.log("reCAPTCHA solved");
                }
            });

            // Don't auto-send OTP here, let user click the button
        } catch (error) {
            console.error("reCAPTCHA setup error:", error);
            setPopup({
                isOpen: true,
                title: "Setup Error",
                message: "Failed to initialize verification. Please refresh the page.",
                type: "error"
            });
        }
    };

    const sendOTP = async () => {
        if (!phone) {
            setPopup({
                isOpen: true,
                title: "Missing Phone",
                message: "Phone number is required.",
                type: "error"
            });
            return;
        }

        setLoading(true);

        try {
            const appVerifier = (window as any).recaptchaVerifier;
            const result = await signInWithPhoneNumber(auth, phone, appVerifier);
            setConfirmationResult(result);
            setOtpSent(true);

            setPopup({
                isOpen: true,
                title: "OTP Sent! 📱",
                message: `Verification code sent to ${phone}`,
                type: "success"
            });
        } catch (error: any) {
            console.error("SMS send error:", error);
            setPopup({
                isOpen: true,
                title: "Failed to Send OTP",
                message: error.message || "Could not send verification code. Please try again.",
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!otp || otp.length !== 6) {
            setPopup({
                isOpen: true,
                title: "Invalid OTP",
                message: "Please enter a valid 6-digit OTP.",
                type: "error"
            });
            return;
        }

        if (!confirmationResult) {
            setPopup({
                isOpen: true,
                title: "Error",
                message: "Please request OTP first.",
                type: "error"
            });
            return;
        }

        setLoading(true);

        try {
            // Verify OTP with Firebase
            const result = await confirmationResult.confirm(otp);
            const firebaseUid = result.user.uid;

            // Call backend to create actual user
            const data = await authApi.verifyPhone({ email, phone, firebaseUid });

            if (data.token) {
                // Store token
                localStorage.setItem("hs_auth_token", data.token);
            }

                setPopup({
                    isOpen: true,
                    title: "Verification Successful! 🎉",
                    message: "Your account has been created. Redirecting to dashboard...",
                    type: "success"
                });

                setTimeout(() => {
                    navigate("/dashboard");
                }, 2000);
        } catch (error: any) {
            console.error("OTP verification error:", error);
            setPopup({
                isOpen: true,
                title: "Verification Failed",
                message: error.message || "The code you entered is incorrect. Please try again.",
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="verify-account-page">
            <Navbar />
            <div id="recaptcha-container"></div>
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

                    <h1 className="verify-title">Verify Your Phone</h1>
                    <p className="verify-subtitle">
                        {otpSent ? "Enter the OTP sent to:" : "We will send an OTP to:"}
                    </p>

                    <div className="email-display">
                        <FaPhone />
                        <span>{phone}</span>
                    </div>

                    {otpSent ? (
                        <form onSubmit={handleVerifyOTP} className="verify-form">
                            <div className="code-input-group">
                                <FaKey className="input-icon" />
                                <input
                                    type="text"
                                    placeholder="Enter 6-digit OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    maxLength={6}
                                    className="code-input"
                                    required
                                />
                            </div>

                            <button type="submit" className="verify-btn" disabled={loading}>
                                {loading ? "Verifying..." : "Verify OTP"}
                            </button>
                        </form>
                    ) : (
                        <button className="verify-btn" onClick={sendOTP} disabled={loading}>
                            {loading ? "Sending OTP..." : "Send OTP"}
                        </button>
                    )}

                    {otpSent && (
                        <div className="verify-footer">
                            <p>Didn't receive the OTP?</p>
                            <button className="resend-link" onClick={sendOTP} disabled={loading}>
                                Resend OTP
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VerifyPhone;
