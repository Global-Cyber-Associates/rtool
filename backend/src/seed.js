import bcrypt from "bcrypt";
import User from "./models/User.js";

export const seedUsers = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const userEmail = process.env.USER_EMAIL;
    const userPassword = process.env.USER_PASSWORD;

    if (!adminEmail || !adminPassword || !userEmail || !userPassword) {
      console.log("⚠️ Missing default credentials in .env, skipping seeding.");
      return;
    }

    // Check for Admin
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.create({
        name: "Admin",
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
      });
      console.log(`✅ Default Admin created: ${adminEmail}`);
    } else {
      console.log("ℹ️ Admin already exists.");
    }

    // Check for User
    const existingUser = await User.findOne({ email: userEmail });
    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(userPassword, 10);
      await User.create({
        name: "User",
        email: userEmail,
        password: hashedPassword,
        role: "user",
      });
      console.log(`✅ Default User created: ${userEmail}`);
    } else {
      console.log("ℹ️ User already exists.");
    }
  } catch (error) {
    console.error("❌ Error seeding users:", error);
  }
};
