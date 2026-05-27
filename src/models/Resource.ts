import { Schema, model, type InferSchemaType } from "mongoose";

const resourceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["turf", "pool", "sports"], required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    locationName: { type: String, required: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    facilities: [{ type: String }],
    images: [{ type: String }],
    pricePerHour: { type: Number, required: true, min: 0 },
    minimumBookingAmount: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

resourceSchema.index({ location: "2dsphere" });

export type ResourceDocument = InferSchemaType<typeof resourceSchema>;
export const ResourceModel = model("Resource", resourceSchema);
