import { Schema, model, type InferSchemaType } from "mongoose";
import { ROLES } from "../constants/roles";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
      index: true,
    },
    googleId: { type: String, sparse: true, unique: true, index: true },
    emailVerified: { type: Boolean, default: false, index: true },
    emailVerificationTokenHash: { type: String, index: true },
    emailVerificationExpiresAt: { type: Date },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
      index: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel = model("User", userSchema);
