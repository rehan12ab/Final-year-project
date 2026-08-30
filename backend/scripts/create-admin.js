import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Admin from "../models/Admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: join(__dirname, '..', '.env') });

const createAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.MONGO_DB_NAME || "hacksentinel",
        });

        console.log("Connected to MongoDB");

        // Admin details
        const adminData = {
            fullName: "Super Admin",
            email: "admin@hacksentinel.com",
            password: "Admin@123456", // Change this to a secure password
            phone: "+923152143941", // Updated admin phone
            role: "super_admin"
        };

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: adminData.email });
        if (existingAdmin) {
            console.log("❌ Admin already exists with email:", adminData.email);
            process.exit(0);
        }

        // Hash password
        const passwordHash = await bcrypt.hash(adminData.password, 10);

        // Create admin
        const admin = await Admin.create({
            fullName: adminData.fullName,
            email: adminData.email,
            passwordHash,
            phone: adminData.phone,
            role: adminData.role,
            isActive: true
        });

        console.log("✅ Admin created successfully!");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📧 Email:", admin.email);
        console.log("🔑 Password:", adminData.password);
        console.log("📱 Phone:", admin.phone);
        console.log("👤 Role:", admin.role);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("⚠️  IMPORTANT: Change the password after first login!");
        console.log("🔗 Admin Signin URL: http://localhost:5173/admin/signin");

        process.exit(0);
    } catch (error) {
        console.error("❌ Error creating admin:", error);
        process.exit(1);
    }
};

createAdmin();
