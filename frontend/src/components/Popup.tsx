import React, { useEffect } from 'react';
import './Popup.css';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface PopupProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
    duration?: number; // Auto close duration in ms
}

const Popup: React.FC<PopupProps> = ({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
    duration = 0
}) => {

    useEffect(() => {
        if (isOpen && duration > 0) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isOpen, duration, onClose]);

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle size={32} className="popup-icon success" />;
            case 'error': return <AlertCircle size={32} className="popup-icon error" />;
            default: return <Info size={32} className="popup-icon info" />;
        }
    };

    return (
        <div className="popup-overlay">
            <div className={`popup-container ${type}`}>
                <button className="popup-close" onClick={onClose}>
                    <X size={20} />
                </button>
                <div className="popup-content">
                    {getIcon()}
                    <div className="popup-text">
                        <h3>{title}</h3>
                        <p>{message}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Popup;
