"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listResourceReviews = listResourceReviews;
exports.createReview = createReview;
const zod_1 = require("zod");
const Review_1 = require("../models/Review");
const Booking_1 = require("../models/Booking");
const createReviewSchema = zod_1.z.object({
    resourceId: zod_1.z.string(),
    rating: zod_1.z.number().min(1).max(5),
    comment: zod_1.z.string().max(1000).optional(),
});
async function listResourceReviews(req, res) {
    const reviews = await Review_1.ReviewModel.find({ resourceId: req.params.resourceId }).sort({ createdAt: -1 });
    res.json(reviews);
}
async function createReview(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const hasCompletedBooking = await Booking_1.BookingModel.findOne({
        userId: req.user.id,
        resourceId: parsed.data.resourceId,
        bookingStatus: { $in: ["confirmed", "no_show"] },
    });
    if (!hasCompletedBooking) {
        res.status(400).json({ message: "Review allowed only after completed booking" });
        return;
    }
    const review = await Review_1.ReviewModel.findOneAndUpdate({ userId: req.user.id, resourceId: parsed.data.resourceId }, {
        $set: {
            rating: parsed.data.rating,
            comment: parsed.data.comment ?? "",
        },
    }, { upsert: true, new: true });
    res.status(201).json(review);
}
