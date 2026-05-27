import { Schema, model, type InferSchemaType } from "mongoose";

const bookingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    resourceId: { type: Schema.Types.ObjectId, ref: "Resource", required: true, index: true },
    slotId: { type: Schema.Types.ObjectId, ref: "Slot", required: true, unique: true, index: true },
    bookingDate: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    commission: { type: Number, default: 0, min: 0 },
    bookingStatus: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "refunded", "no_show"],
      default: "pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "manual_pending", "awaiting_approval"],
      default: "manual_pending",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["manual", "bkash", "sslcommerz"],
      default: "manual",
      index: true,
    },
    manualTransactionId: { type: String, trim: true, index: true },
    manualPaymentNote: { type: String, trim: true, maxlength: 300 },
    manualSubmittedAt: { type: Date },
    manualReviewNote: { type: String, trim: true, maxlength: 300 },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

bookingSchema.index({ userId: 1, createdAt: -1 });

export type BookingDocument = InferSchemaType<typeof bookingSchema>;
export const BookingModel = model("Booking", bookingSchema);
