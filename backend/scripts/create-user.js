import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import User from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "..", ".env") });

const createUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.MONGO_DB_NAME || "hacksentinel",
        });

        console.log("Connected to MongoDB");

        const userData = {
            fullName: "Rehan Akram",
            email: "rehan@company.com",
            password: "HackSentinel@2026!Rehan",
            phone: "+923152143950",
        };

        const existing = await User.findOne({
            $or: [{ email: userData.email }, { phone: userData.phone }],
        });

        if (existing) {
            console.log("User already exists:", existing.email);
            process.exit(0);
        }

        const passwordHash = await bcrypt.hash(userData.password, 10);

        const user = await User.create({
            fullName: userData.fullName,
            email: userData.email,
            passwordHash,
            phone: userData.phone,
            twoFactorEnabled: false,
        });

        console.log("User created successfully");
        console.log("Email:   ", user.email);
        console.log("Password:", userData.password);
        console.log("Phone:   ", user.phone);
        console.log("Signin:  http://localhost:5173/signin");

        process.exit(0);
    } catch (err) {
        console.error("Error creating user:", err);
        process.exit(1);
    }
};

createUser();
