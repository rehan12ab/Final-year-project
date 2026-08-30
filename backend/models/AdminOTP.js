import mongoose from "mongoose";

const adminOTPSchema = new mongoose.Schema(
    {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            required: true,
        },
        otp: {
            type: String,
            required: true,
        },
        method: {
            type: String,
            enum: ['email', 'phone'],
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        },
        verified: {
            type: Boolean,
            default: false,
        }
    },
    { timestamps: true }
);

// Auto-delete expired OTPs
adminOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AdminOTP = mongoose.model("AdminOTP", adminOTPSchema);

export default AdminOTP;
