import mongoose from "mongoose";

const pendingUserSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            required: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: true,
        },
        paymentMethod: {
            cardHolderName: String,
            cardNumberLast4: String,
            expiryDate: String,
            cardType: String
        },
        enable2FA: {
            type: Boolean,
            default: false
        },
        createdAt: {
            type: Date,
            default: Date.now,
            expires: 3600, // Document expires after 1 hour if not verified
        },
    }
);

const PendingUser = mongoose.model("PendingUser", pendingUserSchema);

export default PendingUser;
