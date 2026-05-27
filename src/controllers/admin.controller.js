"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCommission = updateCommission;
exports.getCommission = getCommission;
exports.getPlatformStats = getPlatformStats;
exports.listOwners = listOwners;
exports.updateOwnerStatus = updateOwnerStatus;
exports.updateResourceCommission = updateResourceCommission;
exports.listAllResources = listAllResources;
exports.listUsers = listUsers;
exports.updateUserStatus = updateUserStatus;
exports.createUserByAdmin = createUserByAdmin;
exports.listAssignableUsers = listAssignableUsers;
exports.listUsers = listUsers;
const zod_1 = require("zod");
const User_1 = require("../models/User");
const Booking_1 = require("../models/Booking");
const Payment_1 = require("../models/Payment");
const Resource_1 = require("../models/Resource");
const PlatformSetting_1 = require("../models/PlatformSetting");
const roles_1 = require("../constants/roles");
const password_1 = require("../utils/password");
const updateCommissionSchema = zod_1.z.object({
    commissionRate: zod_1.z.number().min(0).max(100),
});
const updateOwnerStatusSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
});
const updateResourceCommissionSchema = zod_1.z.object({
    commissionRate: zod_1.z.number().min(0).max(100),
});
const createUserByAdminSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum([roles_1.ROLES.USER, roles_1.ROLES.OWNER, roles_1.ROLES.STAFF, roles_1.ROLES.ADMIN]),
    ownerId: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
async function getOrCreateSettings() {
    const settings = await PlatformSetting_1.PlatformSettingModel.findOneAndUpdate({ key: "default" }, { $setOnInsert: { commissionRate: 10 } }, { new: true, upsert: true });
    return settings;
}
async function updateCommission(req, res) {
    const parsed = updateCommissionSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const settings = await PlatformSetting_1.PlatformSettingModel.findOneAndUpdate({ key: "default" }, { $set: { commissionRate: parsed.data.commissionRate } }, { new: true, upsert: true });
    res.json(settings);
}
async function getCommission(_req, res) {
    const settings = await getOrCreateSettings();
    res.json({ commissionRate: settings.commissionRate });
}
async function getPlatformStats(_req, res) {
    const [totalBookings, activeUsers, activeOwners, totalResources] = await Promise.all([
        Booking_1.BookingModel.countDocuments(),
        User_1.UserModel.countDocuments({ isActive: true, role: "user" }),
        User_1.UserModel.countDocuments({ isActive: true, role: "owner" }),
        Resource_1.ResourceModel.countDocuments(),
    ]);
    const [paymentPaidAgg, paymentRefundAgg, paidPayments, refundPayments] = await Promise.all([
        Payment_1.PaymentModel.aggregate([
            { $match: { status: "paid" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Payment_1.PaymentModel.aggregate([
            { $match: { status: "refunded" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Payment_1.PaymentModel.countDocuments({ status: "paid" }),
        Payment_1.PaymentModel.countDocuments({ status: "refunded" }),
    ]);
    // Fallback for legacy data without payment rows.
    const bookingRevenueAgg = await Booking_1.BookingModel.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const bookingRefundAgg = await Booking_1.BookingModel.aggregate([
        { $match: { paymentStatus: "refunded" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalRevenue = paymentPaidAgg[0]?.total ?? bookingRevenueAgg[0]?.total ?? 0;
    const totalRefund = paymentRefundAgg[0]?.total ?? bookingRefundAgg[0]?.total ?? 0;
    res.json({
        totalBookings,
        activeUsers,
        activeOwners,
        totalResources,
        paidPayments,
        refundPayments,
        totalRevenue,
        totalRefund,
    });
}
async function listOwners(_req, res) {
    const owners = await User_1.UserModel.find({ role: "owner" })
        .select("_id name email isActive createdAt")
        .sort({ createdAt: -1 });
    res.json(owners);
}
async function updateOwnerStatus(req, res) {
    const parsed = updateOwnerStatusSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const owner = await User_1.UserModel.findOneAndUpdate({ _id: req.params.ownerId, role: "owner" }, { $set: { isActive: parsed.data.isActive } }, { new: true });
    if (!owner) {
        res.status(404).json({ message: "Owner not found" });
        return;
    }
    res.json(owner);
}
async function listUsers(req, res) {
    const role = req.query.role;
    const filter = role ? { role } : { role: { $in: ["user", "owner", "staff"] } };
    const users = await User_1.UserModel.find(filter)
        .select("_id name email role isActive createdAt")
        .sort({ createdAt: -1 });
    res.json(users);
}
async function updateUserStatus(req, res) {
    const parsed = updateOwnerStatusSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const user = await User_1.UserModel.findOneAndUpdate({ _id: req.params.userId, role: { $ne: "admin" } }, { $set: { isActive: parsed.data.isActive } }, { new: true });
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
    }
    res.json(user);
}
async function listAllResources(_req, res) {
    const resources = await Resource_1.ResourceModel.find().sort({ createdAt: -1 });
    res.json(resources);
}
async function updateResourceCommission(req, res) {
    const parsed = updateResourceCommissionSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const resource = await Resource_1.ResourceModel.findByIdAndUpdate(req.params.resourceId, { $set: { commissionRate: parsed.data.commissionRate } }, { new: true });
    if (!resource) {
        res.status(404).json({ message: "Resource not found" });
        return;
    }
    res.json(resource);
}
async function createUserByAdmin(req, res) {
    const parsed = createUserByAdminSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const email = parsed.data.email.toLowerCase();
    const exists = await User_1.UserModel.findOne({ email });
    if (exists) {
        res.status(409).json({ message: "Email already in use" });
        return;
    }
    let ownerId;
    if (parsed.data.role === roles_1.ROLES.STAFF) {
        if (!parsed.data.ownerId) {
            res.status(400).json({ message: "ownerId is required when role is staff" });
            return;
        }
        const owner = await User_1.UserModel.findOne({ _id: parsed.data.ownerId, role: roles_1.ROLES.OWNER, isActive: true });
        if (!owner) {
            res.status(400).json({ message: "Invalid ownerId. Active owner required." });
            return;
        }
        ownerId = owner._id;
    }
    const passwordHash = await (0, password_1.hashPassword)(parsed.data.password);
    const user = await User_1.UserModel.create({
        name: parsed.data.name,
        email,
        passwordHash,
        role: parsed.data.role,
        ownerId,
        isActive: parsed.data.isActive ?? true,
        authProvider: "local",
    });
    res.status(201).json({
        message: "User created by admin",
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
        },
    });
}
async function listAssignableUsers(_req, res) {
    const users = await User_1.UserModel.find({
        role: { $in: [roles_1.ROLES.OWNER, roles_1.ROLES.STAFF] },
        isActive: true,
    })
        .select("_id name email role ownerId")
        .sort({ role: 1, name: 1 });
    res.json({
        owners: users.filter((user) => user.role === roles_1.ROLES.OWNER),
        staff: users.filter((user) => user.role === roles_1.ROLES.STAFF),
    });
}
async function listUsers(_req, res) {
    const users = await User_1.UserModel.find({})
        .select("_id name email role isActive ownerId createdAt")
        .sort({ createdAt: -1 });
    res.json(users);
}
