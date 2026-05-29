"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPaymentMethods = listPaymentMethods;
exports.listPublicPaymentMethods = listPublicPaymentMethods;
exports.createPaymentMethod = createPaymentMethod;
exports.updatePaymentMethod = updatePaymentMethod;
const zod_1 = require("zod");
const PaymentMethod_1 = require("../models/PaymentMethod");
const manualPayment_service_1 = require("../services/manualPayment.service");
const createSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(2).max(32).regex(/^[a-z0-9_]+$/),
    label: zod_1.z.string().trim().min(2).max(64),
    requiresTransactionId: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().min(0).optional(),
});
const updateSchema = zod_1.z.object({
    label: zod_1.z.string().trim().min(2).max(64).optional(),
    requiresTransactionId: zod_1.z.boolean().optional(),
    active: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().min(0).optional(),
});
async function listPublicPaymentMethods(_req, res) {
    await (0, manualPayment_service_1.seedPaymentMethods)();
    const methods = await (0, manualPayment_service_1.listActivePaymentMethods)();
    res.json(methods);
}
async function listPaymentMethods(_req, res) {
    await (0, manualPayment_service_1.seedPaymentMethods)();
    const methods = await PaymentMethod_1.PaymentMethodModel.find().sort({ sortOrder: 1, label: 1 });
    res.json(methods);
}
async function createPaymentMethod(req, res) {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const code = parsed.data.code.toLowerCase();
    const existing = await PaymentMethod_1.PaymentMethodModel.findOne({ code });
    if (existing) {
        res.status(409).json({ message: "Payment method code already exists" });
        return;
    }
    const method = await PaymentMethod_1.PaymentMethodModel.create({
        code,
        label: parsed.data.label,
        requiresTransactionId: parsed.data.requiresTransactionId ?? true,
        sortOrder: parsed.data.sortOrder ?? 99,
        active: true,
    });
    res.status(201).json(method);
}
async function updatePaymentMethod(req, res) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const method = await PaymentMethod_1.PaymentMethodModel.findById(req.params.methodId);
    if (!method) {
        res.status(404).json({ message: "Payment method not found" });
        return;
    }
    if (parsed.data.label !== undefined) {
        method.label = parsed.data.label;
    }
    if (parsed.data.requiresTransactionId !== undefined) {
        method.requiresTransactionId = parsed.data.requiresTransactionId;
    }
    if (parsed.data.active !== undefined) {
        method.active = parsed.data.active;
    }
    if (parsed.data.sortOrder !== undefined) {
        method.sortOrder = parsed.data.sortOrder;
    }
    await method.save();
    res.json(method);
}
