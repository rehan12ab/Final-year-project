import React from 'react';
import './DashboardPageHeader.css';

interface Props {
    badge: string;
    title: string;
    accent?: string;      // optional accent word rendered with .text-gradient
    subtitle?: string;
    actions?: React.ReactNode;
}

const DashboardPageHeader: React.FC<Props> = ({ badge, title, accent, subtitle, actions }) => {
    return (
        <div className="dash-page-header">
            <div className="dash-page-header-text">
                <div className="glow-badge">{badge}</div>
                <h1 className="dash-page-title">
                    {title}
                    {accent && (
                        <>
                            {' '}
                            <span className="text-gradient">{accent}</span>
                        </>
                    )}
                </h1>
                {subtitle && <p className="dash-page-subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="dash-page-header-actions">{actions}</div>}
        </div>
    );
};

export default DashboardPageHeader;
