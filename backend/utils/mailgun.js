// Mailgun is disabled for now - will be enabled once credentials are provided
export const sendEmail = async (to, subject, html) => {
    console.warn('⚠️ Mailgun is currently disabled');
    console.log(`📧 Would have sent email to: ${to}`);
    console.log(`📧 Subject: ${subject}`);
    return { success: true, message: 'Email simulated (Mailgun disabled)' };
};

// Send OTP via email for 2FA
export const sendOTPEmail = async (to, otp, userName = 'User') => {
    const subject = 'Your HackSentinel 2FA Code';
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }
                .header h1 { margin: 0; font-size: 24px; }
                .content { padding: 40px 30px; }
                .otp-box { background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
                .otp-code { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
                .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔒 HackSentinel 2FA Verification</h1>
                </div>
                <div class="content">
                    <p>Hello ${userName},</p>
                    <p>You requested a 2FA verification code to sign in to your HackSentinel account.</p>
                    <div class="otp-box">
                        <p style="margin: 0 0 10px 0; color: #6c757d;">Your verification code is:</p>
                        <div class="otp-code">${otp}</div>
                    </div>
                    <p><strong>This code will expire in 5 minutes.</strong></p>
                    <p>If you didn't request this code, please ignore this email or contact support if you have concerns.</p>
                </div>
                <div class="footer">
                    <p>© 2024 HackSentinel. All rights reserved.</p>
                    <p>This is an automated message, please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    console.warn('⚠️ Mailgun is currently disabled');
    console.log(`📧 Would have sent OTP email to: ${to}`);
    console.log(`📧 OTP Code: ${otp}`);
    console.log(`📧 User: ${userName}`);

    return { success: true, message: 'Email OTP simulated (Mailgun disabled)' };
};

export default { sendEmail, sendOTPEmail };
