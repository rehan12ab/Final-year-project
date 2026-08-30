# HackSentinel Backend

Backend API server for HackSentinel - A comprehensive web vulnerability scanner and security platform.

## Tech Stack

- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **Firebase** for phone OTP verification
- **Mailgun** for email services (optional)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your MongoDB connection string
   - Add Firebase credentials
   - Set JWT secret

3. Run development server:
```bash
npm run dev
```

4. Production:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/signin` - User login
- `POST /api/auth/verify-phone` - Verify phone number (Firebase)
- `POST /api/auth/verify-2fa-otp` - Verify phone OTP (Firebase)
- `POST /api/auth/verify-email-otp` - Verify email OTP
- `POST /api/auth/resend-email-otp` - Resend email OTP
- `POST /api/auth/forgot-password-email` - Request password reset
- `POST /api/auth/reset-password-email` - Reset password with token

### User Settings
- `GET /api/settings/profile` - Get user profile
- `PUT /api/settings/profile` - Update user profile
- `PUT /api/settings/password` - Change password

### Subscriptions
- `GET /api/subscription/plans` - Get available plans
- `POST /api/subscription/subscribe` - Subscribe to plan

### Contact
- `POST /api/contact` - Submit contact form

### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications/mark-read` - Mark notification as read

## Deployment to Railway

1. Create new project on Railway
2. Connect your GitHub repository
3. Set root directory to `/server`
4. Add environment variables in Railway dashboard
5. Deploy!

Railway will automatically detect the `package.json` and run `npm start`.

## Environment Variables Required

See `.env.example` for all required environment variables.
