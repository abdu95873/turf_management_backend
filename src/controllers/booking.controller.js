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
exports.recordBookingPayment = recordBookingPayment;
exports.downloadInvoice = downloadInvoice;
const zod_1 = require("zod");
const Booking_1 = require("../models/Booking");
const Payment_1 = require("../models/Payment");
const ManualPaymentTransaction_1 = require("../models/ManualPaymentTransaction");
const Slot_1 = require("../models/Slot");
const Resource_1 = require("../models/Resource");
const User_1 = require("../models/User");
const roles_1 = require("../constants/roles");
const userQuery_1 = require("../utils/userQuery");
const booking_service_1 = require("../services/booking.service");
const manualPayment_service_1 = require("../services/manualPayment.service");
const createBookingSchema = zod_1.z.object({
    slotId: zod_1.z.string(),
    idempotencyKey: zod_1.z.string().min(8),
});
const updateStatusSchema = zod_1.z.object({
    bookingStatus: zod_1.z.enum(["confirmed", "cancelled", "refunded", "no_show"]),
    paymentStatus: zod_1.z.enum(["pending", "paid", "failed", "refunded", "manual_pending", "partial_paid", "awaiting_approval"]).optional(),
});
const manualPaymentSchema = zod_1.z.object({
    amount: zod_1.z.number().positive(),
    paymentMethodCode: zod_1.z.string().trim().min(2).max(32),
    transactionId: zod_1.z.string().trim().max(40).optional(),
    note: zod_1.z.string().trim().max(300).optional(),
});
const recordPaymentSchema = manualPaymentSchema;
const reviewManualPaymentSchema = zod_1.z.object({
    action: zod_1.z.enum(["approve", "reject"]),
    manualPaymentId: zod_1.z.string().optional(),
    note: zod_1.z.string().trim().max(300).optional(),
});
const createManagedBookingSchema = zod_1.z
    .object({
    userId: zod_1.z.string().optional(),
    guestName: zod_1.z.string().trim().min(2).max(80).optional(),
    guestPhone: zod_1.z.string().trim().min(6).max(20).optional(),
    slotId: zod_1.z.string(),
    idempotencyKey: zod_1.z.string().min(8),
    amount: zod_1.z.number().positive(),
    paymentMethodCode: zod_1.z.string().trim().min(2).max(32),
    transactionId: zod_1.z.string().trim().max(40).optional(),
    note: zod_1.z.string().trim().max(300).optional(),
})
    .refine((data) => Boolean(data.userId) || (Boolean(data.guestName) && Boolean(data.guestPhone)), {
    message: "Select a registered customer or enter walk-in name and phone",
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
    res.json(await (0, manualPayment_service_1.attachManualPayments)(bookings));
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
    res.json(await (0, manualPayment_service_1.attachManualPayments)(bookings));
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
    let customer = null;
    let bookingUserId = req.user.id;
    if (parsed.data.userId) {
        customer = await User_1.UserModel.findOne((0, userQuery_1.activeUserFilter)({
            _id: parsed.data.userId,
            role: roles_1.ROLES.USER,
        }));
        if (!customer) {
            res.status(404).json({ message: "Customer account not found" });
            return;
        }
        bookingUserId = customer.id;
    }
    try {
        const booking = await (0, booking_service_1.createBookingAtomic)({
            userId: bookingUserId,
            slotId: parsed.data.slotId,
            idempotencyKey: parsed.data.idempotencyKey,
        });
        if (parsed.data.guestName && parsed.data.guestPhone) {
            booking.isWalkIn = true;
            booking.guestName = parsed.data.guestName;
            booking.guestPhone = parsed.data.guestPhone;
        }
        await (0, manualPayment_service_1.recordManualPaymentTransaction)({
            booking,
            amount: parsed.data.amount,
            paymentMethodCode: parsed.data.paymentMethodCode,
            transactionId: parsed.data.transactionId,
            note: parsed.data.note,
            recordedBy: req.user.id,
            source: "dashboard",
            autoApprove: true,
        });
        booking.manualReviewNote = "Recorded from dashboard";
        (0, manualPayment_service_1.confirmBookingIfAnyPayment)(booking);
        await booking.save();
        const enriched = (await (0, manualPayment_service_1.attachManualPayments)([booking]))[0];
        const customerInfo = customer
            ? { id: customer.id, name: customer.name, email: customer.email }
            : { name: parsed.data.guestName, phone: parsed.data.guestPhone, walkIn: true };
        res.status(201).json({
            message: "Booking created and payment recorded",
            booking: enriched,
            customer: customerInfo,
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
    if (!["manual_pending", "failed", "partial_paid"].includes(booking.paymentStatus)) {
        res.status(400).json({ message: "Manual payment cannot be submitted for this booking" });
        return;
    }
    try {
        await (0, manualPayment_service_1.recordManualPaymentTransaction)({
            booking,
            amount: parsed.data.amount,
            paymentMethodCode: parsed.data.paymentMethodCode,
            transactionId: parsed.data.transactionId,
            note: parsed.data.note,
            recordedBy: req.user.id,
            source: "customer",
            autoApprove: false,
        });
        booking.manualSubmittedAt = new Date();
        await booking.save();
        const enriched = (await (0, manualPayment_service_1.attachManualPayments)([booking]))[0];
        res.json({
            message: "Payment submitted for review. Owner or staff will verify your payment.",
            booking: enriched,
        });
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Payment submission failed" });
    }
}
async function recordBookingPayment(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = recordPaymentSchema.safeParse(req.body);
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
    if (["refunded", "pending"].includes(booking.paymentStatus)) {
        res.status(400).json({ message: "Cannot record manual payment for this booking" });
        return;
    }
    try {
        await (0, manualPayment_service_1.recordManualPaymentTransaction)({
            booking,
            amount: parsed.data.amount,
            paymentMethodCode: parsed.data.paymentMethodCode,
            transactionId: parsed.data.transactionId,
            note: parsed.data.note,
            recordedBy: req.user.id,
            source: "dashboard",
            autoApprove: true,
        });
        (0, manualPayment_service_1.confirmBookingIfAnyPayment)(booking);
        await booking.save();
        const enriched = (await (0, manualPayment_service_1.attachManualPayments)([booking]))[0];
        res.json({
            message: "Payment recorded",
            booking: enriched,
        });
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Could not record payment" });
    }
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
    if (booking.paymentStatus !== "awaiting_approval") {
        res.status(400).json({ message: "No manual payment awaiting approval" });
        return;
    }
    let pending = null;
    if (parsed.data.manualPaymentId) {
        pending = await ManualPaymentTransaction_1.ManualPaymentTransactionModel.findOne({
            _id: parsed.data.manualPaymentId,
            bookingId: booking._id,
            status: "pending",
        });
    }
    else {
        pending = await ManualPaymentTransaction_1.ManualPaymentTransactionModel.findOne({
            bookingId: booking._id,
            status: "pending",
        }).sort({ createdAt: 1 });
    }
    if (!pending) {
        res.status(400).json({ message: "No pending payment to review" });
        return;
    }
    try {
        if (parsed.data.action === "approve") {
            await (0, manualPayment_service_1.approvePendingTransaction)(booking, pending._id, req.user.id, parsed.data.note);
            if (parsed.data.note) {
                booking.manualReviewNote = parsed.data.note;
            }
            (0, manualPayment_service_1.confirmBookingIfAnyPayment)(booking);
            await booking.save();
        }
        else {
            await (0, manualPayment_service_1.rejectPendingTransaction)(booking, pending._id, req.user.id, parsed.data.note);
            if (parsed.data.note) {
                booking.manualReviewNote = parsed.data.note;
            }
            const stillPending = await ManualPaymentTransaction_1.ManualPaymentTransactionModel.countDocuments({
                bookingId: booking._id,
                status: "pending",
            });
            if (stillPending === 0 && (booking.amountPaid ?? 0) <= 0) {
                booking.paymentStatus = "failed";
                booking.bookingStatus = "cancelled";
                await Slot_1.SlotModel.findByIdAndUpdate(booking.slotId, { $set: { status: "available" } });
            }
            await booking.save();
        }
        const enriched = (await (0, manualPayment_service_1.attachManualPayments)([booking]))[0];
        res.json({
            message: parsed.data.action === "approve" ? "Manual payment approved" : "Manual payment rejected",
            booking: enriched,
        });
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Review failed" });
    }
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
    if (parsed.data.bookingStatus === "confirmed") {
        const blockedStatuses = ["awaiting_approval", "pending"];
        if (blockedStatuses.includes(booking.paymentStatus)) {
            res.status(400).json({ message: "Payment must be verified before confirming this booking" });
            return;
        }
    }
    else if (parsed.data.paymentStatus) {
        booking.paymentStatus = parsed.data.paymentStatus;
    }
    booking.bookingStatus = parsed.data.bookingStatus;
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
    if (parsed.data.paymentStatus === "refunded" || parsed.data.bookingStatus === "refunded") {
        await Payment_1.PaymentModel.findOneAndUpdate({ bookingId: booking._id }, { $set: { status: "refunded" } });
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
