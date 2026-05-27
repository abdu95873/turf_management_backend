import { Schema, model, type InferSchemaType } from "mongoose";

const slotSchema = new Schema(
  {
    resourceId: { type: Schema.Types.ObjectId, ref: "Resource", required: true, index: true },
    date: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: {
      type: String,
      enum: ["available", "booked", "blocked"],
      default: "available",
      index: true,
    },
    blockedReason: { type: String },
    generatedByRule: { type: Boolean, default: false },
  },
  { timestamps: true }
);

slotSchema.index({ resourceId: 1, date: 1, startTime: 1 }, { unique: true });
slotSchema.index({ resourceId: 1, date: 1, status: 1 });

export type SlotDocument = InferSchemaType<typeof slotSchema>;
export const SlotModel = model("Slot", slotSchema);
