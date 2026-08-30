import React, { useState, useEffect, useRef } from "react";
import "./signup.css";
import Navbar from "./components/Navbar";
import Popup from "./components/Popup";
import { FaUser, FaEnvelope, FaLock, FaPhone } from "react-icons/fa";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import {
  BsShieldLockFill,
  BsLightningFill,
  BsCheckCircleFill,
} from "react-icons/bs";
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "./services/api";

interface FormData {
  fullName: string;
  email: string;
  countryCode: string;
  phone: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
  enable2FA: boolean;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

interface CountryCode {
  code: string;
  name: string;
  length: number;
  placeholder: string;
}

const countryCodes: CountryCode[] = [
  { code: "+92", name: "Pakistan", length: 10, placeholder: "3001234567" },
  { code: "+91", name: "India", length: 10, placeholder: "9876543210" },
  { code: "+1", name: "USA", length: 10, placeholder: "2025551234" },
  { code: "+44", name: "UK", length: 10, placeholder: "7911123456" },
  { code: "+971", name: "UAE", length: 9, placeholder: "501234567" },
  { code: "+966", name: "Saudi Arabia", length: 9, placeholder: "501234567" },
];

const Signup: React.FC = () => {
  const navigate = useNavigate();

  // Popup State
  const [popup, setPopup] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    countryCode: "+92",
    phone: "",
    password: "",
    confirmPassword: "",
    terms: false,
    enable2FA: false,
  });

  const [showPassword, setShowPassword] = useState({
    password: false,
    confirmPassword: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fullNameRef.current?.value)
      fullNameRef.current.parentElement?.classList.add("filled");
    if (emailRef.current?.value)
      emailRef.current.parentElement?.classList.add("filled");
    if (passwordRef.current?.value)
      passwordRef.current.parentElement?.classList.add("filled");
    if (confirmPasswordRef.current?.value)
      confirmPasswordRef.current.parentElement?.classList.add("filled");
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = "checked" in e.target ? (e.target as HTMLInputElement).checked : false;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    setErrors((prev) => ({ ...prev, [name]: "" }));
    setApiError(null);
  };

  const handlePhoneChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      phone: value,
    }));
    setErrors((prev) => ({ ...prev, phone: "" }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Check for admin session conflict
    const adminToken = localStorage.getItem("hs_admin_token");
    if (adminToken) {
      setPopup({
        isOpen: true,
        title: "Access Denied",
        message: "Admin session is active. Please logout from admin panel first to signup as user.",
        type: "error"
      });
      return;
    }

    const newErrors: FormErrors = {};

    if (!formData.fullName) newErrors.fullName = "Full Name is required";
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.phone) newErrors.phone = "Phone number is required";

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";

    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    if (!formData.terms)
      newErrors.terms = "You must accept Terms & Conditions";

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    try {
      setSubmitting(true);
      setApiError(null);

      await authApi.signup({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone.startsWith('+') ? formData.phone : `+${formData.phone}`,
        password: formData.password,
        enable2FA: formData.enable2FA,
      });

      setPopup({
        isOpen: true,
        title: "Account Created! 🎉",
        message: "Please verify your phone number to complete registration.",
        type: "success",
      });

      setTimeout(() => {
        navigate(
          `/verify-phone?email=${encodeURIComponent(
            formData.email
          )}&phone=${encodeURIComponent(
            formData.phone.startsWith('+') ? formData.phone : `+${formData.phone}`
          )}`
        );
      }, 2000);
    } catch (err) {
      console.error("Signup request failed:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Unable to reach the server. Please try again in a moment.";
      setApiError(message);
      setPopup({
        isOpen: true,
        title: "Sign Up Failed",
        message,
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup-page">
      <Navbar />
      <Popup
        isOpen={popup.isOpen}
        onClose={() => setPopup({ ...popup, isOpen: false })}
        title={popup.title}
        message={popup.message}
        type={popup.type}
      />
      <div className="auth-content">
        <div className="signup-left">
          <div className="glow-badge" style={{ marginBottom: '1.5rem', width: 'fit-content' }}>
            New Organization Account
          </div>
          <h1 className="signup-left-title">Join <span className="text-gradient">HackSentinel</span></h1>
          <p className="signup-left-desc">
            Deploy autonomous security agents to discover, verify, and remediate vulnerabilities across your digital attack surface.
          </p>

          <div className="signup-left-features">
            <div className="feature-box">
              <div className="feature-icon-halo indigo">
                <BsShieldLockFill />
              </div>
              <div>
                <h4>Zero False Positives</h4>
                <p>Multi-model AI verification checks actual exploitability</p>
              </div>
            </div>
            <div className="feature-box">
              <div className="feature-icon-halo cyan">
                <BsLightningFill />
              </div>
              <div>
                <h4>Continuous CI/CD Scans</h4>
                <p>Block insecure pull requests before code reaches production</p>
              </div>
            </div>
            <div className="feature-box">
              <div className="feature-icon-halo violet">
                <BsCheckCircleFill />
              </div>
              <div>
                <h4>Automated Executive Reports</h4>
                <p>Instant PDF and Word reports formatted for audits and bug bounties</p>
              </div>
            </div>
          </div>
        </div>

        <div className="signup-right">
          <form onSubmit={handleSubmit} className="signup-form glass-card">
            <div className="auth-form-header">
              <div className="auth-logo-badge">
                <img src="/logo.png" alt="HackSentinel Logo" className="auth-logo-img" />
              </div>
              <h1 className="signup-title">Create Your Account</h1>
              <p className="signup-subtitle">Start your 14-day free vulnerability audit</p>
            </div>
            {apiError && <div className="api-error-banner">{apiError}</div>}

            {/* Full Name */}
            <div className="form-group">
              <label>Full Name</label>
              <div className="input-wrapper">
                <FaUser className="input-icon" />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Alex Mercer"
                  className="form-input"
                  ref={fullNameRef}
                  autoComplete="name"
                />
              </div>
              {errors.fullName && <span className="error">{errors.fullName}</span>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label>Work Email</label>
              <div className="input-wrapper">
                <FaEnvelope className="input-icon" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="alex@company.com"
                  className="form-input"
                  ref={emailRef}
                  autoComplete="email"
                />
              </div>
              {errors.email && <span className="error">{errors.email}</span>}
            </div>

            {/* Phone Number with Country Code */}
            <div className="form-group phone-group-new">
              <label>Phone Number</label>
              <PhoneInput
                country={'pk'}
                value={formData.phone}
                onChange={handlePhoneChange}
                enableSearch={true}
                containerClass="phone-container"
                inputClass="phone-input-field"
                buttonClass="phone-button"
                placeholder="Enter phone number"
              />
              {errors.phone && <span className="error">{errors.phone}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label>Password</label>
              <div className="input-wrapper">
                <FaLock className="input-icon" />
                <input
                  type={showPassword.password ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 8 characters"
                  className="form-input"
                  ref={passwordRef}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword((prev) => ({
                      ...prev,
                      password: !prev.password,
                    }))
                  }
                >
                  {showPassword.password ? (
                    <AiOutlineEyeInvisible />
                  ) : (
                    <AiOutlineEye />
                  )}
                </button>
              </div>
              {errors.password && <span className="error">{errors.password}</span>}

              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="password-strength-wrap">
                  <div className="strength-bar-bg">
                    <div
                      className={`strength-bar-fill ${formData.password.length >= 8 ? (/[0-9]/.test(formData.password) && /[^a-zA-Z0-9]/.test(formData.password) ? 'strong' : 'medium') : 'weak'}`}
                      style={{
                        width: formData.password.length < 6 ? '25%' : formData.password.length < 8 ? '50%' : /[^a-zA-Z0-9]/.test(formData.password) ? '100%' : '75%'
                      }}
                    ></div>
                  </div>
                  <span className="strength-label">
                    {formData.password.length < 6
                      ? 'Weak Password'
                      : formData.password.length < 8
                        ? 'Fair'
                        : /[^a-zA-Z0-9]/.test(formData.password)
                          ? 'Strong Password 🔒'
                          : 'Good Password'}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label>Confirm Password</label>
              <div className="input-wrapper">
                <FaLock className="input-icon" />
                <input
                  type={showPassword.confirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  className="form-input"
                  ref={confirmPasswordRef}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword((prev) => ({
                      ...prev,
                      confirmPassword: !prev.confirmPassword,
                    }))
                  }
                >
                  {showPassword.confirmPassword ? (
                    <AiOutlineEyeInvisible />
                  ) : (
                    <AiOutlineEye />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="error">{errors.confirmPassword}</span>
              )}
            </div>

            {/* Terms */}
            <label className="terms-label">
              <input
                type="checkbox"
                name="terms"
                checked={formData.terms}
                onChange={handleChange}
              />
              <span>I accept the <span className="underline">Terms & Conditions</span></span>
            </label>
            {errors.terms && <span className="error">{errors.terms}</span>}

            {/* 2FA Optional Checkbox */}
            <label className="terms-label" style={{
              marginTop: '0.75rem',
              padding: '0.75rem 1rem',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%)',
              borderRadius: '10px',
              border: '1px dashed rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <input
                type="checkbox"
                name="enable2FA"
                checked={formData.enable2FA}
                onChange={handleChange}
                style={{ accentColor: '#10b981' }}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{ color: '#1e1b4b', fontWeight: 600, fontSize: '0.95rem' }}>
                  🔒 Enable Two-Factor Authentication
                </span>
                <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 400 }}>
                  (Optional) Add extra security with OTP verification on signin
                </span>
              </span>
            </label>

            <button type="submit" className="submit-btn shimmer-hover" disabled={submitting}>
              {submitting ? "Creating account..." : "Sign Up"}
            </button>

            <p className="signin-text">
              Already have an account?{" "}
              <Link to="/signin" className="signin-link">
                Sign In
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
