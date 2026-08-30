import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';
import { Menu, X, ArrowRight, ShieldCheck } from 'lucide-react';

const Navbar: React.FC = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 20) {
                setScrolled(true);
            } else {
                setScrolled(false);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    return (
        <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
            <div className="navbar-container">
                {/* Logo */}
                <Link to="/" className="navbar-logo" onClick={closeMobileMenu}>
                    <div className="logo-badge">
                        <img src="/logo.svg" alt="HackSentinel Logo" className="logo-img" />
                    </div>
                    <span className="logo-text">Hack<span className="logo-accent">Sentinel</span></span>
                </Link>

                {/* Desktop Navigation Links */}
                <ul className={`nav-menu ${isMobileMenuOpen ? 'active' : ''}`}>
                    <li className="nav-item">
                        <Link
                            to="/"
                            className={`nav-link ${isActive('/') ? 'active' : ''}`}
                            onClick={closeMobileMenu}
                        >
                            Home
                        </Link>
                    </li>
                    <li className="nav-item">
                        <Link
                            to="/about"
                            className={`nav-link ${isActive('/about') ? 'active' : ''}`}
                            onClick={closeMobileMenu}
                        >
                            About Us
                        </Link>
                    </li>
                    <li className="nav-item">
                        <Link
                            to="/services"
                            className={`nav-link ${isActive('/services') ? 'active' : ''}`}
                            onClick={closeMobileMenu}
                        >
                            Services
                        </Link>
                    </li>
                    <li className="nav-item">
                        <Link
                            to="/features"
                            className={`nav-link ${isActive('/features') ? 'active' : ''}`}
                            onClick={closeMobileMenu}
                        >
                            Features
                        </Link>
                    </li>
                    <li className="nav-item">
                        <Link
                            to="/pricing"
                            className={`nav-link ${isActive('/pricing') ? 'active' : ''}`}
                            onClick={closeMobileMenu}
                        >
                            Pricing
                        </Link>
                    </li>
                    <li className="nav-item">
                        <Link
                            to="/contact"
                            className={`nav-link ${isActive('/contact') ? 'active' : ''}`}
                            onClick={closeMobileMenu}
                        >
                            Contact
                        </Link>
                    </li>

                    {/* Mobile Auth Actions */}
                    <li className="nav-item mobile-auth-group">
                        <Link to="/signin" className="nav-signin-link" onClick={closeMobileMenu}>
                            Sign In
                        </Link>
                        <Link to="/signup" className="nav-cta-btn shimmer-hover" onClick={closeMobileMenu}>
                            <span>Get Started</span>
                            <ArrowRight size={16} />
                        </Link>
                    </li>
                </ul>

                {/* Desktop Auth Actions */}
                <div className="desktop-actions">
                    <Link to="/signin" className="nav-signin-link">
                        Sign In
                    </Link>
                    <Link to="/signup" className="nav-cta-btn shimmer-hover">
                        <span>Get Started</span>
                        <ArrowRight size={16} className="btn-arrow" />
                    </Link>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    className="mobile-menu-toggle"
                    onClick={toggleMobileMenu}
                    aria-label="Toggle navigation menu"
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
