import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    subscription: {
      plan: {
        type: String,
        enum: ['free', 'professional', 'enterprise'],
        default: 'free'
      },
      status: {
        type: String,
        enum: ['active', 'cancelled', 'expired'],
        default: 'active'
      },
      startDate: Date,
      endDate: Date
    },
    paymentMethod: {
      cardHolderName: String,
      cardNumberLast4: String,
      expiryDate: String,
      cardType: String
    },
    // 2FA (Two-Factor Authentication) fields
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorMethod: {
      type: String,
      enum: ['email', 'phone'],
      default: 'phone'
    },
    twoFactorOTP: {
      type: String,
      default: null
    },
    twoFactorOTPExpiry: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

const User = mongoose.model("User", userSchema);

export default User;


