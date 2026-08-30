import mongoose from "mongoose";

const tokenBlacklistSchema = new mongoose.Schema(
    {
        token: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'userType'
        },
        userType: {
            type: String,
            required: true,
            enum: ['User', 'Admin']
        },
        expiresAt: {
            type: Date,
            required: true,
        }
    },
    { timestamps: true }
);

// TTL index to automatically remove expired tokens
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TokenBlacklist = mongoose.model("TokenBlacklist", tokenBlacklistSchema);

export default TokenBlacklist;
