"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStaff = listStaff;
exports.createStaff = createStaff;
exports.updateStaffStatus = updateStaffStatus;
exports.deleteStaff = deleteStaff;
exports.updateStaff = updateStaff;
exports.getOwnerEarnings = getOwnerEarnings;
const zod_1 = require("zod");
const User_1 = require("../models/User");
const Booking_1 = require("../models/Booking");
const Resource_1 = require("../models/Resource");
const password_1 = require("../utils/password");
const roles_1 = require("../constants/roles");
const createStaffSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const updateStaffStatusSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
});
const updateStaffSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    email: zod_1.z.string().email().optional(),
    password: zod_1.z.string().min(6).optional(),
});
async function listStaff(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const staff = await User_1.UserModel.find({ role: roles_1.ROLES.STAFF, ownerId: req.user.id })
        .select("_id name email isActive createdAt")
        .sort({ createdAt: -1 });
    res.json(staff);
}
async function createStaff(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = createStaffSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const exists = await User_1.UserModel.findOne({ email: parsed.data.email.toLowerCase() });
    if (exists) {
        res.status(409).json({ message: "Email already in use" });
        return;
    }
    const passwordHash = await (0, password_1.hashPassword)(parsed.data.password);
    const staff = await User_1.UserModel.create({
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        role: roles_1.ROLES.STAFF,
        ownerId: req.user.id,
        authProvider: "local",
        isActive: true,
    });
    res.status(201).json(staff);
}
async function updateStaffStatus(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = updateStaffStatusSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const staff = await User_1.UserModel.findOneAndUpdate({ _id: req.params.staffId, role: roles_1.ROLES.STAFF, ownerId: req.user.id }, { $set: { isActive: parsed.data.isActive } }, { new: true });
    if (!staff) {
        res.status(404).json({ message: "Staff not found" });
        return;
    }
    res.json(staff);
}
async function deleteStaff(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const staff = await User_1.UserModel.findOneAndDelete({
        _id: req.params.staffId,
        role: roles_1.ROLES.STAFF,
        ownerId: req.user.id,
    });
    if (!staff) {
        res.status(404).json({ message: "Staff not found" });
        return;
    }
    res.json({ message: "Staff deleted successfully" });
}
async function updateStaff(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = updateStaffSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const staff = await User_1.UserModel.findOne({ _id: req.params.staffId, role: roles_1.ROLES.STAFF, ownerId: req.user.id });
    if (!staff) {
        res.status(404).json({ message: "Staff not found" });
        return;
    }
    if (parsed.data.email && parsed.data.email.toLowerCase() !== staff.email) {
        const exists = await User_1.UserModel.findOne({ email: parsed.data.email.toLowerCase(), _id: { $ne: staff._id } });
        if (exists) {
            res.status(409).json({ message: "Email already in use" });
            return;
        }
        staff.email = parsed.data.email.toLowerCase();
    }
    if (parsed.data.name) {
        staff.name = parsed.data.name;
    }
    if (parsed.data.password) {
        staff.passwordHash = await (0, password_1.hashPassword)(parsed.data.password);
    }
    await staff.save();
    res.json({
        message: "Staff updated successfully",
        staff: {
            _id: staff._id,
            name: staff.name,
            email: staff.email,
            isActive: staff.isActive,
        },
    });
}
function buildBookingDateMatch(from, to) {
    if (!from && !to) {
        return {};
    }
    const bookingDate = {};
    if (from) {
        bookingDate.$gte = String(from);
    }
    if (to) {
        bookingDate.$lte = String(to);
    }
    return { bookingDate };
}
async function getOwnerEarnings(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const from = typeof req.query.from === "string" ? req.query.from.trim() : "";
    const to = typeof req.query.to === "string" ? req.query.to.trim() : "";
    const resources = await Resource_1.ResourceModel.find({ ownerId: req.user.id }).select("_id");
    const resourceIds = resources.map((item) => item._id);
    const agg = await Booking_1.BookingModel.aggregate([
        {
            $match: {
                resourceId: { $in: resourceIds },
                ...buildBookingDateMatch(from, to),
            },
        },
        {
            $group: {
                _id: "$bookingStatus",
                totalAmount: { $sum: "$amount" },
                count: { $sum: 1 },
            },
        },
    ]);
    const response = {
        confirmed: { count: 0, totalAmount: 0 },
        pending: { count: 0, totalAmount: 0 },
        cancelled: { count: 0, totalAmount: 0 },
        refunded: { count: 0, totalAmount: 0 },
        no_show: { count: 0, totalAmount: 0 },
    };
    for (const row of agg) {
        response[row._id] = { count: row.count, totalAmount: row.totalAmount };
    }
    const confirmed = response.confirmed.totalAmount;
    const pending = response.pending.totalAmount;
    const noShow = response.no_show.totalAmount;
    response.grossRevenue = confirmed + pending + noShow;
    response.netRevenue = confirmed + noShow;
    response.dateFilter = { from: from || null, to: to || null };
    res.json(response);
}
