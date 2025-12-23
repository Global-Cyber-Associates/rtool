import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "client"],
      default: "client",
    },

    // Registration info for approval
    isApproved: {
      type: Boolean,
      default: false,
    },

    companyName: {
      type: String,
      trim: true,
    },

    // ⭐ MULTI-TENANT KEY
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: false, // Optional until approved and tenant created
    },

    // User status (soft-disable)
    isActive: {
      type: Boolean,
      default: true,
    },

    // Track last successful login
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
