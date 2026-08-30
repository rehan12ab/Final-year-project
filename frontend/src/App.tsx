import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Signup from "./signup";
import SignIn from "./signin";
import ForgotPassword from "./ForgotPassword";
import ResetPasswordEmail from "./ResetPasswordEmail";
import ResetPasswordOTP from "./ResetPasswordOTP";
import PurchasePlan from "./PurchasePlan";
import Dashboard from "./Dashboard";
import ScanProcess from "./ScanProcess";
import VerifyAccount from "./VerifyAccount";
import VerifyPhone from "./VerifyPhone";
import LandingPage from "./LandingPage";
import Services from "./Services";
import Features from "./Features";
import Contact from "./Contact";
import Pricing from "./Pricing";
import AdminSignin from "./AdminSignin";
import AdminDashboard from "./AdminDashboard";
import AboutPage from "./AboutPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/services" element={<Services />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password-email" element={<ResetPasswordEmail />} />
        <Route path="/reset-password-otp" element={<ResetPasswordOTP />} />
        <Route path="/purchase-plan" element={<PurchasePlan />} />
        <Route path="/verify-account" element={<VerifyAccount />} />
        <Route path="/verify-phone" element={<VerifyPhone />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scan" element={<ScanProcess />} />

        {/* Admin Routes */}
        <Route path="/admin/signin" element={<AdminSignin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
