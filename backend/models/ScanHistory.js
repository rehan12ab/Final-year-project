import mongoose from 'mongoose';

const scanHistorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        url: {
            type: String,
            required: true,
            trim: true
        },
        vulnerabilities: [{
            type: String,
            severity: String,
            description: String
        }],
        scanDate: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['completed', 'failed', 'in-progress'],
            default: 'completed'
        },
        scanDuration: {
            type: Number, // in seconds
            default: 0
        },
        vulnerabilityCount: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

// Index for efficient queries
scanHistorySchema.index({ userId: 1, scanDate: -1 });

const ScanHistory = mongoose.model('ScanHistory', scanHistorySchema);

export default ScanHistory;
