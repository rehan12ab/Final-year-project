import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        type: {
            type: String,
            enum: ['scan', 'security', 'account', 'system', 'admin'],
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        icon: {
            type: String,
            default: 'bi-bell'
        },
        image: {
            type: String,
            default: null
        },
        read: {
            type: Boolean,
            default: false
        },
        link: {
            type: String,
            default: null
        },
        sentBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null
        },
        targetType: {
            type: String,
            enum: ['all', 'specific', 'group'],
            default: null
        },
        targetGroup: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

// Index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
