"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedPaymentMethods = seedPaymentMethods;
exports.listActivePaymentMethods = listActivePaymentMethods;
exports.getPaymentMethodByCode = getPaymentMethodByCode;
exports.getBookingAmountDue = getBookingAmountDue;
exports.syncBookingPaymentState = syncBookingPaymentState;
exports.attachManualPayments = attachManualPayments;
exports.confirmBookingIfAnyPayment = confirmBookingIfAnyPayment;
exports.recordManualPaymentTransaction = recordManualPaymentTransaction;
exports.approvePendingTransaction = approvePendingTransaction;
exports.rejectPendingTransaction = rejectPendingTransaction;
const ManualPaymentTransaction_1 = require("../models/ManualPaymentTransaction");
const PaymentMethod_1 = require("../models/PaymentMethod");
const Payment_1 = require("../models/Payment");
const DEFAULT_METHODS = [
    { code: "bkash", label: "bKash", requiresTransactionId: true, sortOrder: 1 },
    { code: "rocket", label: "Rocket", requiresTransactionId: true, sortOrder: 2 },
    { code: "nagad", label: "Nagad", requiresTransactionId: true, sortOrder: 3 },
    { code: "cash", label: "Cash", requiresTransactionId: false, sortOrder: 4 },
];
async function seedPaymentMethods() {
    for (const method of DEFAULT_METHODS) {
        await PaymentMethod_1.PaymentMethodModel.findOneAndUpdate({ code: method.code }, { $setOnInsert: { ...method, active: true } }, { upsert: true, new: true });
    }
}
async function listActivePaymentMethods() {
    return PaymentMethod_1.PaymentMethodModel.find({ active: true }).sort({ sortOrder: 1, label: 1 });
}
async function getPaymentMethodByCode(code) {
    return PaymentMethod_1.PaymentMethodModel.findOne({ code: code.toLowerCase(), active: true });
}
function getBookingAmountDue(booking) {
    const paid = booking.amountPaid ?? 0;
    return Math.max(0, Math.round((booking.amount - paid) * 100) / 100);
}
async function sumApprovedPayments(bookingId) {
    const rows = await ManualPaymentTransaction_1.ManualPaymentTransactionModel.find({
        bookingId,
        status: "approved",
    }).select("amount");
    return rows.reduce((sum, row) => sum + row.amount, 0);
}
async function hasPendingPayments(bookingId) {
    const count = await ManualPaymentTransaction_1.ManualPaymentTransactionModel.countDocuments({
        bookingId,
        status: "pending",
    });
    return count > 0;
}
async function syncBookingPaymentState(booking) {
    const amountPaid = await sumApprovedPayments(booking._id);
    booking.amountPaid = amountPaid;
    const due = getBookingAmountDue({ ...booking.toObject(), amountPaid });
    const pending = await hasPendingPayments(booking._id);
    if (booking.paymentStatus === "refunded" || booking.paymentStatus === "pending") {
        return booking;
    }
    if (pending) {
        booking.paymentStatus = "awaiting_approval";
    }
    else if (amountPaid <= 0) {
        booking.paymentStatus = booking.paymentStatus === "failed" ? "failed" : "manual_pending";
    }
    else if (due > 0) {
        booking.paymentStatus = "partial_paid";
    }
    else {
        booking.paymentStatus = "paid";
    }
    const latest = await ManualPaymentTransaction_1.ManualPaymentTransactionModel.findOne({
        bookingId: booking._id,
        status: "approved",
    }).sort({ createdAt: -1 });
    if (latest) {
        booking.manualTransactionId = latest.transactionId || booking.manualTransactionId;
        booking.manualPaymentNote = latest.note || booking.manualPaymentNote;
        booking.paymentMethod = "manual";
    }
    await Payment_1.PaymentModel.findOneAndUpdate({ bookingId: booking._id }, {
        $set: {
            userId: booking.userId,
            amount: amountPaid > 0 ? amountPaid : booking.amount,
            provider: "manual",
            status: booking.paymentStatus === "paid" ? "paid" : "initiated",
            transactionId: latest?.transactionId,
            providerPaymentId: latest?.transactionId,
        },
    }, { upsert: true });
    return booking;
}
async function assertTransactionIdAvailable(transactionId, paymentMethodCode, excludeBookingId) {
    if (!transactionId) {
        return;
    }
    const existing = await ManualPaymentTransaction_1.ManualPaymentTransactionModel.findOne({
        transactionId,
        paymentMethodCode,
        status: { $in: ["pending", "approved"] },
        ...(excludeBookingId ? { bookingId: { $ne: excludeBookingId } } : {}),
    });
    if (existing) {
        throw new Error("This transaction ID is already used for this payment method");
    }
}
function confirmBookingIfAnyPayment(booking) {
    if ((booking.amountPaid ?? 0) > 0 && booking.bookingStatus === "pending") {
        booking.bookingStatus = "confirmed";
    }
    return booking;
}
async function recordManualPaymentTransaction(input) {
    const method = await getPaymentMethodByCode(input.paymentMethodCode);
    if (!method) {
        throw new Error("Invalid or inactive payment method");
    }
    const due = getBookingAmountDue(input.booking);
    if (input.amount > due + 0.001) {
        throw new Error(`Payment amount cannot exceed due balance (${due} BDT)`);
    }
    const transactionId = (input.transactionId ?? "").trim();
    if (method.requiresTransactionId && transactionId.length < 4) {
        throw new Error("Transaction ID is required for this payment method");
    }
    await assertTransactionIdAvailable(transactionId, method.code, input.booking._id);
    const status = input.autoApprove ? "approved" : "pending";
    const transaction = await ManualPaymentTransaction_1.ManualPaymentTransactionModel.create({
        bookingId: input.booking._id,
        userId: input.booking.userId,
        amount: input.amount,
        paymentMethodCode: method.code,
        paymentMethodLabel: method.label,
        transactionId: transactionId || undefined,
        note: input.note ?? "",
        status,
        recordedBy: input.recordedBy,
        source: input.source ?? "dashboard",
        reviewedBy: input.autoApprove ? input.recordedBy : undefined,
        reviewedAt: input.autoApprove ? new Date() : undefined,
    });
    await syncBookingPaymentState(input.booking);
    confirmBookingIfAnyPayment(input.booking);
    await input.booking.save();
    return transaction;
}
async function approvePendingTransaction(booking, transactionId, reviewerId, reviewNote) {
    const transaction = await ManualPaymentTransaction_1.ManualPaymentTransactionModel.findOne({
        _id: transactionId,
        bookingId: booking._id,
        status: "pending",
    });
    if (!transaction) {
        throw new Error("Pending payment not found");
    }
    const due = getBookingAmountDue(booking);
    if (transaction.amount > due + 0.001) {
        throw new Error("Approved amount exceeds booking due balance");
    }
    transaction.status = "approved";
    transaction.reviewedBy = reviewerId;
    transaction.reviewedAt = new Date();
    transaction.reviewNote = reviewNote ?? "";
    await transaction.save();
    await syncBookingPaymentState(booking);
    confirmBookingIfAnyPayment(booking);
    await booking.save();
    return transaction;
}
async function rejectPendingTransaction(booking, transactionId, reviewerId, reviewNote) {
    const transaction = await ManualPaymentTransaction_1.ManualPaymentTransactionModel.findOne({
        _id: transactionId,
        bookingId: booking._id,
        status: "pending",
    });
    if (!transaction) {
        throw new Error("Pending payment not found");
    }
    transaction.status = "rejected";
    transaction.reviewedBy = reviewerId;
    transaction.reviewedAt = new Date();
    transaction.reviewNote = reviewNote ?? "";
    await transaction.save();
    await syncBookingPaymentState(booking);
    await booking.save();
    return transaction;
}
async function attachManualPayments(bookings) {
    if (!bookings.length) {
        return [];
    }
    const ids = bookings.map((booking) => booking._id);
    const transactions = await ManualPaymentTransaction_1.ManualPaymentTransactionModel.find({
        bookingId: { $in: ids },
    }).sort({ createdAt: 1 });
    const grouped = {};
    for (const transaction of transactions) {
        const key = String(transaction.bookingId);
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(transaction);
    }
    return bookings.map((booking) => {
        const plain = booking.toObject ? booking.toObject() : booking;
        const manualPayments = grouped[String(plain._id)] ?? [];
        const amountPaidFromLedger = manualPayments
            .filter((payment) => payment.status === "approved")
            .reduce((sum, payment) => sum + payment.amount, 0);
        let amountPaid = amountPaidFromLedger;
        if (amountPaid <= 0 && (plain.amountPaid ?? 0) > 0) {
            amountPaid = plain.amountPaid;
        }
        if (amountPaid <= 0 &&
            plain.manualTransactionId &&
            plain.paymentStatus === "paid" &&
            typeof plain.amount === "number") {
            amountPaid = plain.amount;
        }
        return {
            ...plain,
            amountPaid,
            amountDue: getBookingAmountDue({ amount: plain.amount, amountPaid }),
            manualPayments,
        };
    });
}
