"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiatePayment = initiatePayment;
exports.listMyPayments = listMyPayments;
exports.listManagedPayments = listManagedPayments;
exports.verifyPayment = verifyPayment;
exports.getPaymentStatus = getPaymentStatus;
exports.sslCommerzSuccessCallback = sslCommerzSuccessCallback;
exports.sslCommerzFailCallback = sslCommerzFailCallback;
exports.sslCommerzCancelCallback = sslCommerzCancelCallback;
exports.sslCommerzCallback = sslCommerzCallback;
exports.sslCommerzWebhook = sslCommerzWebhook;
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const env_1 = require("../config/env");
const Booking_1 = require("../models/Booking");
const Payment_1 = require("../models/Payment");
const Slot_1 = require("../models/Slot");
const Resource_1 = require("../models/Resource");
const User_1 = require("../models/User");
const IdempotencyRecord_1 = require("../models/IdempotencyRecord");
const WebhookNonce_1 = require("../models/WebhookNonce");
const WebhookEventLog_1 = require("../models/WebhookEventLog");
const payment_service_1 = require("../services/payment.service");
const initiateSchema = zod_1.z.object({
    bookingId: zod_1.z.string(),
    provider: zod_1.z.enum(["sslcommerz"]).optional(),
});
const verifySchema = zod_1.z.object({
    transactionId: zod_1.z.string().min(3),
    success: zod_1.z.boolean().default(true),
    provider: zod_1.z.enum(["sslcommerz"]).optional(),
});
function requestHash(body) {
    return (0, crypto_1.createHash)("sha256").update(JSON.stringify(body ?? {})).digest("hex");
}
async function getIdempotentResponse(key, scope, reqHash) {
    const existing = await IdempotencyRecord_1.IdempotencyRecordModel.findOne({ key, scope });
    if (!existing) {
        return null;
    }
    if (existing.requestHash !== reqHash) {
        return { conflict: true };
    }
    return { conflict: false, data: existing };
}
async function storeIdempotentResponse(key, scope, reqHash, statusCode, responseBody) {
    await IdempotencyRecord_1.IdempotencyRecordModel.findOneAndUpdate({ key, scope }, {
        $set: {
            requestHash: reqHash,
            statusCode,
            responseBody,
            expiresAt: new Date(Date.now() + env_1.env.IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000),
        },
    }, { upsert: true, new: true });
}
function eventId(provider, eventType, payload) {
    const tx = payload?.trxID ?? payload?.transactionId ?? payload?.tran_id ?? payload?.paymentID ?? payload?.val_id ?? "";
    const fallback = requestHash(payload).slice(0, 16);
    return `${provider}:${eventType}:${tx || fallback}`;
}
async function useNonce(provider, nonce) {
    if (!nonce) {
        return false;
    }
    try {
        await WebhookNonce_1.WebhookNonceModel.create({
            provider,
            nonce,
            expiresAt: new Date(Date.now() + env_1.env.WEBHOOK_NONCE_TTL_MINUTES * 60 * 1000),
        });
        return true;
    }
    catch {
        return false;
    }
}
async function logWebhookEvent(entry) {
    try {
        await WebhookEventLog_1.WebhookEventLogModel.create(entry);
    }
    catch (_error) {
    }
}
async function initiatePayment(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = initiateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const idempotencyKey = String(req.headers["x-idempotency-key"] ?? "");
    const reqHash = requestHash(req.body);
    if (idempotencyKey) {
        const idem = await getIdempotentResponse(idempotencyKey, "payment:initiate", reqHash);
        if (idem?.conflict) {
            res.status(409).json({ message: "Idempotency key reused with different payload" });
            return;
        }
        if (idem?.data) {
            res.status(idem.data.statusCode).json(idem.data.responseBody);
            return;
        }
    }
    const booking = await Booking_1.BookingModel.findOne({ _id: parsed.data.bookingId, userId: req.user.id });
    if (!booking) {
        res.status(404).json({ message: "Booking not found" });
        return;
    }
    if (booking.paymentStatus === "paid") {
        res.status(400).json({ message: "Booking already paid" });
        return;
    }
    booking.paymentMethod = "sslcommerz";
    const session = await (0, payment_service_1.initiateProviderPayment)({
        bookingId: booking.id,
        amount: booking.amount,
        userId: String(booking.userId),
    });
    const payment = await Payment_1.PaymentModel.findOneAndUpdate({ bookingId: booking._id }, {
        $set: {
            userId: booking.userId,
            amount: booking.amount,
            provider: "sslcommerz",
            status: "initiated",
            transactionId: session.transactionId,
            providerPaymentId: session.providerPaymentId,
            gatewayPayload: { initSession: session },
        },
    }, { upsert: true, new: true });
    booking.paymentStatus = "pending";
    await booking.save();
    const responseBody = {
        paymentId: payment._id,
        provider: payment.provider,
        checkoutUrl: session.checkoutUrl,
        transactionId: session.transactionId,
        mode: session.mode,
    };
    if (idempotencyKey) {
        await storeIdempotentResponse(idempotencyKey, "payment:initiate", reqHash, 200, responseBody);
    }
    res.json(responseBody);
}
async function listMyPayments(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const payments = await Payment_1.PaymentModel.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(payments);
}
async function listManagedPayments(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    let resourceIds = [];
    if (req.user.role === "owner") {
        const resources = await Resource_1.ResourceModel.find({ ownerId: req.user.id }).select("_id");
        resourceIds = resources.map((item) => item._id);
    }
    else if (req.user.role === "staff") {
        const staff = await User_1.UserModel.findById(req.user.id).select("ownerId");
        if (staff?.ownerId) {
            const resources = await Resource_1.ResourceModel.find({ ownerId: staff.ownerId }).select("_id");
            resourceIds = resources.map((item) => item._id);
        }
    }
    else {
        const resources = await Resource_1.ResourceModel.find().select("_id");
        resourceIds = resources.map((item) => item._id);
    }
    const bookings = await Booking_1.BookingModel.find({ resourceId: { $in: resourceIds } }).select("_id");
    const bookingIds = bookings.map((item) => item._id);
    const payments = await Payment_1.PaymentModel.find({ bookingId: { $in: bookingIds } }).sort({ createdAt: -1 });
    res.json(payments);
}
async function finalizePaymentByRecord(payment, success, payload, txOverride) {
    if (!payment) {
        return null;
    }
    if (payment.status === "paid" && success) {
        return payment;
    }
    payment.status = success ? "paid" : "failed";
    payment.gatewayPayload = payload;
    if (txOverride) {
        payment.transactionId = txOverride;
    }
    await payment.save();
    const booking = await Booking_1.BookingModel.findById(payment.bookingId);
    if (booking) {
        booking.paymentStatus = success ? "paid" : "failed";
        if (success && booking.bookingStatus === "pending") {
            booking.bookingStatus = "confirmed";
        }
        await booking.save();
    }
    return payment;
}
async function verifyPayment(req, res) {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const idempotencyKey = String(req.headers["x-idempotency-key"] ?? "");
    const reqHash = requestHash(req.body);
    if (idempotencyKey) {
        const idem = await getIdempotentResponse(idempotencyKey, "payment:verify", reqHash);
        if (idem?.conflict) {
            res.status(409).json({ message: "Idempotency key reused with different payload" });
            return;
        }
        if (idem?.data) {
            res.status(idem.data.statusCode).json(idem.data.responseBody);
            return;
        }
    }
    const provider = "sslcommerz";
    const payment = await Payment_1.PaymentModel.findOne({ transactionId: parsed.data.transactionId, provider });
    if (!payment) {
        res.status(404).json({ message: "Payment not found" });
        return;
    }
    const updated = await finalizePaymentByRecord(payment, parsed.data.success, req.body);
    const responseBody = { message: parsed.data.success ? "Payment verified" : "Payment failed", payment: updated };
    if (idempotencyKey) {
        await storeIdempotentResponse(idempotencyKey, "payment:verify", reqHash, 200, responseBody);
    }
    res.json(responseBody);
}
async function getPaymentStatus(req, res) {
    const tranId = String(req.query.tran_id ?? "");
    const bookingId = String(req.query.bookingId ?? "");
    if (!tranId && !bookingId) {
        res.status(400).json({ message: "tran_id or bookingId is required" });
        return;
    }
    const payment = await Payment_1.PaymentModel.findOne(tranId
        ? { transactionId: tranId, provider: "sslcommerz" }
        : { bookingId, provider: "sslcommerz" });
    if (!payment) {
        res.status(404).json({ message: "Payment not found" });
        return;
    }
    res.json({
        transactionId: payment.transactionId,
        bookingId: String(payment.bookingId),
        amount: payment.amount,
        status: payment.status,
    });
}
function getSslPayload(req) {
    return { ...(req.body ?? {}), ...(req.query ?? {}) };
}
function redirectPaymentResult(res, outcome, { tranId, bookingId }) {
    const params = new URLSearchParams();
    if (tranId)
        params.set("tran_id", tranId);
    if (bookingId)
        params.set("bookingId", bookingId);
    const query = params.toString();
    const suffix = query ? `?${query}` : "";
    res.redirect(302, `${env_1.env.APP_BASE_URL}/payment/${outcome}${suffix}`);
}
async function releaseBookingSlot(booking) {
    if (!booking?.slotId)
        return;
    await Slot_1.SlotModel.findByIdAndUpdate(booking.slotId, { $set: { status: "available" } });
}
async function handleSslCommerzCallback(req, res, outcome) {
    const payload = getSslPayload(req);
    const tranId = String(payload.tran_id ?? "");
    const valId = String(payload.val_id ?? "");
    const bookingIdFromGateway = String(payload.value_b ?? "");
    const payment = tranId
        ? await Payment_1.PaymentModel.findOne({
            provider: "sslcommerz",
            $or: [{ transactionId: tranId }, { providerPaymentId: tranId }],
        })
        : null;
    const bookingId = bookingIdFromGateway || (payment ? String(payment.bookingId) : "");
    if (!payment) {
        redirectPaymentResult(res, outcome === "success" ? "fail" : outcome, { tranId, bookingId });
        return;
    }
    const evtId = eventId("sslcommerz", `callback:${outcome}`, payload);
    const exists = await WebhookEventLog_1.WebhookEventLogModel.findOne({ eventId: evtId });
    if (exists) {
        redirectPaymentResult(res, outcome, {
            tranId: payment.transactionId,
            bookingId: String(payment.bookingId),
        });
        return;
    }
    if (outcome === "success") {
        const result = await (0, payment_service_1.verifySSLCommerzPayment)(valId || tranId);
        await finalizePaymentByRecord(payment, result.success, result.payload, result.transactionId);
        await logWebhookEvent({
            provider: "sslcommerz",
            eventType: "callback",
            eventId: evtId,
            signatureValid: true,
            processingStatus: "accepted",
            message: result.success ? "SSLCommerz callback success" : "SSLCommerz callback failed",
            payload,
        });
        redirectPaymentResult(res, result.success ? "success" : "fail", {
            tranId: result.transactionId || tranId,
            bookingId: String(payment.bookingId),
        });
        return;
    }
    if (outcome === "cancel") {
        payment.status = "failed";
        payment.gatewayPayload = payload;
        await payment.save();
        const booking = await Booking_1.BookingModel.findById(payment.bookingId);
        if (booking) {
            booking.paymentStatus = "failed";
            booking.bookingStatus = "cancelled";
            await booking.save();
            await releaseBookingSlot(booking);
        }
        await logWebhookEvent({
            provider: "sslcommerz",
            eventType: "callback",
            eventId: evtId,
            signatureValid: true,
            processingStatus: "accepted",
            message: "SSLCommerz payment cancelled",
            payload,
        });
        redirectPaymentResult(res, "cancel", {
            tranId,
            bookingId: String(payment.bookingId),
        });
        return;
    }
    await finalizePaymentByRecord(payment, false, payload, tranId);
    await logWebhookEvent({
        provider: "sslcommerz",
        eventType: "callback",
        eventId: evtId,
        signatureValid: true,
        processingStatus: "accepted",
        message: "SSLCommerz callback failed",
        payload,
    });
    redirectPaymentResult(res, "fail", {
        tranId,
        bookingId: String(payment.bookingId),
    });
}
async function sslCommerzSuccessCallback(req, res) {
    await handleSslCommerzCallback(req, res, "success");
}
async function sslCommerzFailCallback(req, res) {
    await handleSslCommerzCallback(req, res, "fail");
}
async function sslCommerzCancelCallback(req, res) {
    await handleSslCommerzCallback(req, res, "cancel");
}
async function sslCommerzCallback(req, res) {
    await sslCommerzSuccessCallback(req, res);
}
async function sslCommerzWebhook(req, res) {
    const signature = String(req.headers["x-ssl-signature"] ?? "");
    const nonce = String(req.headers["x-webhook-nonce"] ?? "");
    const rawBody = req.rawBody ?? "";
    const valid = (0, payment_service_1.verifyWebhookSignature)(rawBody, signature, env_1.env.SSLCOMMERZ_WEBHOOK_SECRET);
    const evtId = eventId("sslcommerz", "webhook", req.body ?? {});
    const processed = await WebhookEventLog_1.WebhookEventLogModel.findOne({ eventId: evtId });
    if (processed) {
        await logWebhookEvent({
            provider: "sslcommerz",
            eventType: "webhook",
            eventId: `${evtId}:dup:${Date.now()}`,
            signatureValid: valid,
            nonceUsed: nonce || undefined,
            processingStatus: "duplicate",
            message: "Duplicate webhook ignored",
            payload: req.body,
        });
        res.json({ ok: true, duplicate: true });
        return;
    }
    if (!valid) {
        await logWebhookEvent({
            provider: "sslcommerz",
            eventType: "webhook",
            eventId: evtId,
            signatureValid: false,
            nonceUsed: nonce || undefined,
            processingStatus: "rejected",
            message: "Invalid signature",
            payload: req.body,
        });
        res.status(401).json({ message: "Invalid SSLCommerz webhook signature" });
        return;
    }
    const nonceAccepted = await useNonce("sslcommerz", nonce);
    if (!nonceAccepted) {
        await logWebhookEvent({
            provider: "sslcommerz",
            eventType: "webhook",
            eventId: evtId,
            signatureValid: true,
            nonceUsed: nonce || undefined,
            processingStatus: "rejected",
            message: "Nonce missing/replayed",
            payload: req.body,
        });
        res.status(409).json({ message: "Webhook replay detected" });
        return;
    }
    const tranId = String(req.body?.tran_id ?? "");
    const payment = await Payment_1.PaymentModel.findOne({
        provider: "sslcommerz",
        $or: [{ transactionId: tranId }, { providerPaymentId: tranId }],
    });
    if (!payment) {
        await logWebhookEvent({
            provider: "sslcommerz",
            eventType: "webhook",
            eventId: evtId,
            signatureValid: true,
            nonceUsed: nonce || undefined,
            processingStatus: "failed",
            message: "Payment not found",
            payload: req.body,
        });
        res.status(404).json({ message: "Payment not found" });
        return;
    }
    const result = await (0, payment_service_1.verifySSLCommerzPayment)(req.body?.val_id ?? tranId);
    await finalizePaymentByRecord(payment, result.success, result.payload, result.transactionId);
    await logWebhookEvent({
        provider: "sslcommerz",
        eventType: "webhook",
        eventId: evtId,
        signatureValid: true,
        nonceUsed: nonce || undefined,
        processingStatus: "accepted",
        message: result.success ? "Payment completed" : "Payment failed",
        payload: req.body,
    });
    res.json({ ok: true });
}
