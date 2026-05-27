"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResource = createResource;
exports.listResources = listResources;
exports.getResourceDetails = getResourceDetails;
exports.updateResourcePrice = updateResourcePrice;
exports.updateResourceSettings = updateResourceSettings;
const resourceOwnership_1 = require("../utils/resourceOwnership");
const zod_1 = require("zod");
const Resource_1 = require("../models/Resource");
const Review_1 = require("../models/Review");
const User_1 = require("../models/User");
const roles_1 = require("../constants/roles");
const createResourceSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    type: zod_1.z.enum(["turf", "pool", "sports"]),
    locationName: zod_1.z.string().min(2),
    longitude: zod_1.z.number(),
    latitude: zod_1.z.number(),
    facilities: zod_1.z.array(zod_1.z.string()).default([]),
    images: zod_1.z.array(zod_1.z.string().url()).default([]),
    pricePerHour: zod_1.z.number().nonnegative(),
    minimumBookingAmount: zod_1.z.number().nonnegative().optional(),
    ownerId: zod_1.z.string().optional(),
    staffIds: zod_1.z.array(zod_1.z.string()).max(3, "Maximum 3 staff can be assigned").default([]),
});
const updatePriceSchema = zod_1.z.object({
    pricePerHour: zod_1.z.number().nonnegative(),
});
const updateSettingsSchema = zod_1.z.object({
    pricePerHour: zod_1.z.number().nonnegative().optional(),
    minimumBookingAmount: zod_1.z.number().nonnegative().optional(),
}).refine((data) => data.pricePerHour !== undefined || data.minimumBookingAmount !== undefined, {
    message: "Provide pricePerHour and/or minimumBookingAmount",
});
async function createResource(req, res) {
    const parsed = createResourceSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const data = parsed.data;
    const isAdmin = req.user.role === roles_1.ROLES.ADMIN;
    let ownerId = req.user.id;
    if (isAdmin && data.ownerId) {
        const owner = await User_1.UserModel.findOne({ _id: data.ownerId, role: roles_1.ROLES.OWNER, isActive: true });
        if (!owner) {
            res.status(400).json({ message: "Invalid ownerId. Active owner required." });
            return;
        }
        ownerId = owner.id;
    }
    const uniqueStaffIds = Array.from(new Set((data.staffIds ?? []).filter(Boolean)));
    if (uniqueStaffIds.length > 3) {
        res.status(400).json({ message: "Maximum 3 staff can be assigned" });
        return;
    }
    let validatedStaff = [];
    if (uniqueStaffIds.length) {
        validatedStaff = await User_1.UserModel.find({
            _id: { $in: uniqueStaffIds },
            role: roles_1.ROLES.STAFF,
            isActive: true,
        }).select("_id ownerId");
        if (validatedStaff.length !== uniqueStaffIds.length) {
            res.status(400).json({ message: "One or more staff IDs are invalid." });
            return;
        }
        const hasMismatchedOwner = validatedStaff.some((staff) => staff.ownerId && String(staff.ownerId) !== String(ownerId));
        if (hasMismatchedOwner) {
            res.status(400).json({ message: "Selected staff are not linked to the chosen owner." });
            return;
        }
    }
    const resource = await Resource_1.ResourceModel.create({
        name: data.name,
        type: data.type,
        ownerId,
        staffIds: validatedStaff.map((staff) => staff._id),
        locationName: data.locationName,
        location: { type: "Point", coordinates: [data.longitude, data.latitude] },
        facilities: data.facilities,
        images: data.images,
        pricePerHour: data.pricePerHour,
        minimumBookingAmount: data.minimumBookingAmount ?? 0,
    });
    res.status(201).json(resource);
}
async function listResources(req, res) {
    const city = req.query.city ? String(req.query.city) : undefined;
    const query = city ? { locationName: new RegExp(city, "i"), isActive: true } : { isActive: true };
    const resources = await Resource_1.ResourceModel.find(query).sort({ createdAt: -1 });
    res.json(resources);
}
async function getResourceDetails(req, res) {
    const resource = await Resource_1.ResourceModel.findById(req.params.resourceId);
    if (!resource) {
        res.status(404).json({ message: "Resource not found" });
        return;
    }
    const reviews = await Review_1.ReviewModel.find({ resourceId: resource._id }).sort({ createdAt: -1 }).limit(20);
    const ratingAgg = await Review_1.ReviewModel.aggregate([
        { $match: { resourceId: resource._id } },
        { $group: { _id: null, avgRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } },
    ]);
    res.json({
        resource,
        reviews,
        rating: {
            avg: Number((ratingAgg[0]?.avgRating ?? 0).toFixed(2)),
            total: ratingAgg[0]?.totalReviews ?? 0,
        },
    });
}
async function updateResourcePrice(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = updatePriceSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const resource = await Resource_1.ResourceModel.findById(req.params.resourceId);
    if (!resource) {
        res.status(404).json({ message: "Resource not found" });
        return;
    }
    const isAdmin = req.user.role === roles_1.ROLES.ADMIN;
    if (!isAdmin && String(resource.ownerId) !== String(req.user.id)) {
        res.status(403).json({ message: "Forbidden for this resource" });
        return;
    }
    resource.pricePerHour = parsed.data.pricePerHour;
    await resource.save();
    res.json({ message: "Resource price updated", resource });
}
async function updateResourceSettings(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const ownership = await (0, resourceOwnership_1.verifyResourceOwnership)(req, req.params.resourceId);
    if (!ownership.ok) {
        res.status(ownership.status).json({ message: ownership.message });
        return;
    }
    const resource = ownership.resource;
    const isStaff = req.user.role === roles_1.ROLES.STAFF;
    if (isStaff && parsed.data.pricePerHour !== undefined) {
        res.status(403).json({ message: "Staff cannot change hourly price" });
        return;
    }
    if (parsed.data.pricePerHour !== undefined) {
        resource.pricePerHour = parsed.data.pricePerHour;
    }
    if (parsed.data.minimumBookingAmount !== undefined) {
        resource.minimumBookingAmount = parsed.data.minimumBookingAmount;
    }
    await resource.save();
    res.json({ message: "Venue settings updated", resource });
}
