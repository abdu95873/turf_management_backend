"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBooking = createBooking;
exports.listMyBookings = listMyBookings;
exports.cancelMyBooking = cancelMyBooking;
exports.listManagedBookings = listManagedBookings;
exports.listManagedResources = listManagedResources;
exports.lookupCustomers = lookupCustomers;
exports.createManagedBooking = createManagedBooking;
exports.updateBookingStatus = updateBookingStatus;
exports.submitManualPayment = submitManualPayment;
exports.reviewManualPayment = reviewManualPayment;
exports.downloadInvoice = downloadInvoice;
const zod_1 = require("zod");
const Booking_1 = require("../models/Booking");
const Payment_1 = require("../models/Payment");
const Slot_1 = require("../models/Slot");
const Resource_1 = require("../models/Resource");
const User_1 = require("../models/User");
const roles_1 = require("../constants/roles");
const userQuery_1 = require("../utils/userQuery");
const booking_service_1 = require("../services/booking.service");
const createBookingSchema = zod_1.z.object({
    slotId: zod_1.z.string(),
    idempotencyKey: zod_1.z.string().min(8),
});
const updateStatusSchema = zod_1.z.object({
    bookingStatus: zod_1.z.enum(["confirmed", "cancelled", "refunded", "no_show"]),
    paymentStatus: zod_1.z.enum(["pending", "paid", "failed", "refunded", "manual_pending", "awaiting_approval"]).optional(),
    transactionId: zod_1.z.string().trim().min(4).max(40).optional(),
    note: zod_1.z.string().trim().max(300).optional(),
});
const manualPaymentSchema = zod_1.z.object({
    transactionId: zod_1.z.string().trim().min(4).max(40),
    note: zod_1.z.string().trim().max(300).optional(),
});
const reviewManualPaymentSchema = zod_1.z.object({
    action: zod_1.z.enum(["approve", "reject"]),
    note: zod_1.z.string().trim().max(300).optional(),
});
const createManagedBookingSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    slotId: zod_1.z.string(),
    idempotencyKey: zod_1.z.string().min(8),
    transactionId: zod_1.z.string().trim().min(4).max(40),
    note: zod_1.z.string().trim().max(300).optional(),
});
async function getManagedResourceIds(user) {
    if (user.role === "owner") {
        const resources = await Resource_1.ResourceModel.find({ ownerId: user.id }).select("_id");
        return resources.map((item) => item._id);
    }
    if (user.role === "staff") {
        const staff = await User_1.UserModel.findById(user.id).select("ownerId");
        if (staff?.ownerId) {
            const resources = await Resource_1.ResourceModel.find({ ownerId: staff.ownerId }).select("_id");
            return resources.map((item) => item._id);
        }
        return [];
    }
    const resources = await Resource_1.ResourceModel.find().select("_id");
    return resources.map((item) => item._id);
}
async function assertCanManageBooking(user, booking) {
    if (user.role === "admin") {
        return true;
    }
    const resourceIds = await getManagedResourceIds(user);
    return resourceIds.some((id) => String(id) === String(booking.resourceId));
}
async function assertCanManageResource(user, resourceId) {
    if (user.role === "admin") {
        return true;
    }
    const resourceIds = await getManagedResourceIds(user);
    return resourceIds.some((id) => String(id) === String(resourceId));
}
async function createBooking(req, res) {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const booking = await (0, booking_service_1.createBookingAtomic)({
            userId: req.user.id,
            slotId: parsed.data.slotId,
            idempotencyKey: parsed.data.idempotencyKey,
        });
        res.status(201).json(booking);
    }
    catch (error) {
        res.status(409).json({ message: error instanceof Error ? error.message : "Booking failed" });
    }
}
async function listMyBookings(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const bookings = await Booking_1.BookingModel.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(bookings);
}
async function cancelMyBooking(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const bookingId = req.params.bookingId;
    const booking = await Booking_1.BookingModel.findOne({
        _id: bookingId,
        userId: req.user.id,
        bookingStatus: { $in: ["pending", "confirmed"] },
    });
    if (!booking) {
        res.status(404).json({ message: "Cancelable booking not found" });
        return;
    }
    booking.bookingStatus = "cancelled";
    await booking.save();
    await Slot_1.SlotModel.findByIdAndUpdate(booking.slotId, { $set: { status: "available" } });
    res.json({ message: "Booking cancelled successfully" });
}
async function listManagedBookings(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const resourceIds = await getManagedResourceIds(req.user);
    const bookings = await Booking_1.BookingModel.find({ resourceId: { $in: resourceIds } }).sort({ createdAt: -1 }).limit(500);
    res.json(bookings);
}
async function listManagedResources(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const resourceIds = await getManagedResourceIds(req.user);
    const resources = await Resource_1.ResourceModel.find({ _id: { $in: resourceIds } })
        .select("name pricePerHour locationName isActive")
        .sort({ name: 1 });
    res.json(resources);
}
async function lookupCustomers(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const query = String(req.query.q ?? "").trim();
    if (query.length < 2) {
        res.json([]);
        return;
    }
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User_1.UserModel.find((0, userQuery_1.activeUserFilter)({
        role: roles_1.ROLES.USER,
        $or: [{ email: pattern }, { name: pattern }],
    }))
        .select("name email")
        .sort({ email: 1 })
        .limit(10);
    res.json(users.map((user) => ({ id: user.id, name: user.name, email: user.email })));
}
async function createManagedBooking(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = createManagedBookingSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const slot = await Slot_1.SlotModel.findById(parsed.data.slotId);
    if (!slot) {
        res.status(404).json({ message: "Slot not found" });
        return;
    }
    if (!(await assertCanManageResource(req.user, slot.resourceId))) {
        res.status(403).json({ message: "You cannot book slots for this venue" });
        return;
    }
    const customer = await User_1.UserModel.findOne((0, userQuery_1.activeUserFilter)({
        _id: parsed.data.userId,
        role: roles_1.ROLES.USER,
    }));
    if (!customer) {
        res.status(404).json({ message: "Customer account not found" });
        return;
    }
    const duplicate = await Booking_1.BookingModel.findOne({
        manualTransactionId: parsed.data.transactionId,
        paymentStatus: { $in: ["awaiting_approval", "paid", "pending"] },
    });
    if (duplicate) {
        res.status(409).json({ message: "This transaction ID is already used" });
        return;
    }
    try {
        const booking = await (0, booking_service_1.createBookingAtomic)({
            userId: customer.id,
            slotId: parsed.data.slotId,
            idempotencyKey: parsed.data.idempotencyKey,
        });
        booking.manualTransactionId = parsed.data.transactionId;
        booking.manualPaymentNote = parsed.data.note ?? "";
        booking.manualSubmittedAt = new Date();
        booking.manualReviewNote = "Recorded from dashboard";
        booking.paymentMethod = "manual";
        booking.paymentStatus = "paid";
        booking.bookingStatus = "confirmed";
        await booking.save();
        await Payment_1.PaymentModel.findOneAndUpdate({ bookingId: booking._id }, {
            $set: {
                userId: booking.userId,
                amount: booking.amount,
                provider: "manual",
                status: "paid",
                transactionId: parsed.data.transactionId,
                providerPaymentId: parsed.data.transactionId,
                gatewayPayload: {
                    note: parsed.data.note ?? "",
                    recordedBy: req.user.id,
                    recordedAt: new Date(),
                    source: "dashboard",
                },
            },
        }, { upsert: true, new: true });
        res.status(201).json({
            message: "Booking created and manual payment recorded",
            booking,
            customer: { id: customer.id, name: customer.name, email: customer.email },
        });
    }
    catch (error) {
        res.status(409).json({ message: error instanceof Error ? error.message : "Booking failed" });
    }
}
async function submitManualPayment(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = manualPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const booking = await Booking_1.BookingModel.findOne({
        _id: req.params.bookingId,
        userId: req.user.id,
        bookingStatus: "pending",
    });
    if (!booking) {
        res.status(404).json({ message: "Pending booking not found" });
        return;
    }
    if (!["manual_pending", "failed"].includes(booking.paymentStatus)) {
        res.status(400).json({ message: "Manual payment cannot be submitted for this booking" });
        return;
    }
    const duplicate = await Booking_1.BookingModel.findOne({
        manualTransactionId: parsed.data.transactionId,
        _id: { $ne: booking._id },
        paymentStatus: { $in: ["awaiting_approval", "paid", "pending"] },
    });
    if (duplicate) {
        res.status(409).json({ message: "This transaction ID is already used" });
        return;
    }
    booking.manualTransactionId = parsed.data.transactionId;
    booking.manualPaymentNote = parsed.data.note ?? "";
    booking.manualSubmittedAt = new Date();
    booking.paymentMethod = "manual";
    booking.paymentStatus = "awaiting_approval";
    await booking.save();
    await Payment_1.PaymentModel.findOneAndUpdate({ bookingId: booking._id }, {
        $set: {
            userId: booking.userId,
            amount: booking.amount,
            provider: "manual",
            status: "initiated",
            transactionId: parsed.data.transactionId,
            providerPaymentId: parsed.data.transactionId,
            gatewayPayload: {
                note: parsed.data.note ?? "",
                submittedAt: booking.manualSubmittedAt,
            },
        },
    }, { upsert: true, new: true });
    res.json({
        message: "Payment submitted for review. Owner or staff will verify your transaction ID.",
        booking,
    });
}
async function reviewManualPayment(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = reviewManualPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const booking = await Booking_1.BookingModel.findById(req.params.bookingId);
    if (!booking) {
        res.status(404).json({ message: "Booking not found" });
        return;
    }
    if (!(await assertCanManageBooking(req.user, booking))) {
        res.status(403).json({ message: "You cannot manage this booking" });
        return;
    }
  if (!(await assertCanManageBooking(req.user, booking))) {
        res.status(403).json({ message: "You cannot manage this booking" });
        return;
    }
    if (booking.paymentStatus !== "awaiting_approval") {
        res.status(400).json({ message: "No manual payment awaiting approval" });
        return;
    }
    const payment = await Payment_1.PaymentModel.findOne({ bookingId: booking._id, provider: "manual" });
    if (parsed.data.action === "approve") {
        booking.paymentStatus = "paid";
        booking.bookingStatus = "confirmed";
        if (parsed.data.note) {
            booking.manualReviewNote = parsed.data.note;
        }
        if (payment) {
            payment.status = "paid";
            payment.gatewayPayload = {
                ...(payment.gatewayPayload ?? {}),
                reviewedAt: new Date(),
                reviewedBy: req.user.id,
                action: "approve",
                note: parsed.data.note ?? "",
            };
            await payment.save();
        }
    }
    else {
        booking.paymentStatus = "failed";
        booking.bookingStatus = "cancelled";
        if (parsed.data.note) {
            booking.manualReviewNote = parsed.data.note;
        }
        if (payment) {
            payment.status = "failed";
            payment.gatewayPayload = {
                ...(payment.gatewayPayload ?? {}),
                reviewedAt: new Date(),
                reviewedBy: req.user.id,
                action: "reject",
                note: parsed.data.note ?? "",
            };
            await payment.save();
        }
        await Slot_1.SlotModel.findByIdAndUpdate(booking.slotId, { $set: { status: "available" } });
    }
    await booking.save();
    res.json({
        message: parsed.data.action === "approve" ? "Manual payment approved" : "Manual payment rejected",
        booking,
    });
}
async function updateBookingStatus(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const booking = await Booking_1.BookingModel.findById(req.params.bookingId);
    if (!booking) {
        res.status(404).json({ message: "Booking not found" });
        return;
    }
    if (!(await assertCanManageBooking(req.user, booking))) {
        res.status(403).json({ message: "You cannot manage this booking" });
        return;
    }
    if (!(await assertCanManageBooking(req.user, booking))) {
        res.status(403).json({ message: "You cannot manage this booking" });
        return;
    }
    booking.bookingStatus = parsed.data.bookingStatus;
    if (parsed.data.paymentStatus) {
        booking.paymentStatus = parsed.data.paymentStatus;
    }
    if (parsed.data.bookingStatus === "confirmed") {
        const slot = await Slot_1.SlotModel.findById(booking.slotId);
        if (!slot) {
            res.status(404).json({ message: "Slot not found" });
            return;
        }
        if (slot.status === "available") {
            slot.status = "booked";
            await slot.save();
        }
        else if (slot.status !== "booked") {
            res.status(409).json({ message: "Slot is not available for confirmation" });
            return;
        }
        else {
            const otherBooking = await Booking_1.BookingModel.findOne({
                slotId: slot._id,
                _id: { $ne: booking._id },
                bookingStatus: { $in: ["pending", "confirmed"] },
            });
            if (otherBooking) {
                res.status(409).json({ message: "Slot is already booked by another customer" });
                return;
            }
        }
    }
    await booking.save();
    if (parsed.data.bookingStatus === "cancelled" || parsed.data.bookingStatus === "refunded") {
        await Slot_1.SlotModel.findByIdAndUpdate(booking.slotId, { $set: { status: "available" } });
    }
    res.json(booking);
}
async function downloadInvoice(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const booking = await Booking_1.BookingModel.findOne({ _id: req.params.bookingId, userId: req.user.id });
    if (!booking) {
        res.status(404).json({ message: "Booking not found" });
        return;
    }
    const invoiceText = [
        `INVOICE #${booking._id}`,
        `Date: ${booking.bookingDate}`,
        `Time: ${booking.startTime}-${booking.endTime}`,
        `Amount: ${booking.amount} BDT`,
        `Booking status: ${booking.bookingStatus}`,
        `Payment status: ${booking.paymentStatus}`,
        booking.manualTransactionId ? `Transaction ID: ${booking.manualTransactionId}` : "",
    ].join("\n");
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${booking._id}.txt`);
    res.send(invoiceText);
}
