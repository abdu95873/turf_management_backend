import { Schema, model, type InferSchemaType } from "mongoose";

const reviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    resourceId: { type: Schema.Types.ObjectId, ref: "Resource", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

reviewSchema.index({ userId: 1, resourceId: 1 }, { unique: true });

export type ReviewDocument = InferSchemaType<typeof reviewSchema>;
export const ReviewModel = model("Review", reviewSchema);
