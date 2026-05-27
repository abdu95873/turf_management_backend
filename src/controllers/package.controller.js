"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPackages = listPackages;
exports.createPackage = createPackage;
exports.updatePackage = updatePackage;
exports.deletePackage = deletePackage;
const zod_1 = require("zod");
const Package_1 = require("../models/Package");
const Resource_1 = require("../models/Resource");
const createPackageSchema = zod_1.z.object({
    resourceId: zod_1.z.string(),
    sportType: zod_1.z.string().min(1),
    name: zod_1.z.string().min(2),
    durationMinutes: zod_1.z.number().min(15),
    pricePerSlot: zod_1.z.number().min(0),
});
const updatePackageSchema = zod_1.z.object({
    sportType: zod_1.z.string().min(1).optional(),
    name: zod_1.z.string().min(2).optional(),
    durationMinutes: zod_1.z.number().min(15).optional(),
    pricePerSlot: zod_1.z.number().min(0).optional(),
});
async function verifyResourceOwner(req, resourceId) {
    const resource = await Resource_1.ResourceModel.findById(resourceId);
    if (!resource) {
        return { ok: false, status: 404, message: "Resource not found" };
    }
    if (String(resource.ownerId) !== req.user.id) {
        return { ok: false, status: 403, message: "You do not own this resource" };
    }
    return { ok: true, resource };
}
async function listPackages(req, res) {
    const resourceId = String(req.query.resourceId ?? "");
    if (!resourceId) {
        res.status(400).json({ message: "resourceId is required" });
        return;
    }
    const packages = await Package_1.PackageModel.find({ resourceId, isActive: true }).sort({ createdAt: -1 });
    res.json(packages);
}
async function createPackage(req, res) {
    const parsed = createPackageSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const ownership = await verifyResourceOwner(req, parsed.data.resourceId);
    if (!ownership.ok) {
        res.status(ownership.status).json({ message: ownership.message });
        return;
    }
    const pkg = await Package_1.PackageModel.create(parsed.data);
    res.status(201).json(pkg);
}
async function updatePackage(req, res) {
    const parsed = updatePackageSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const pkg = await Package_1.PackageModel.findById(req.params.packageId);
    if (!pkg) {
        res.status(404).json({ message: "Package not found" });
        return;
    }
    const ownership = await verifyResourceOwner(req, pkg.resourceId);
    if (!ownership.ok) {
        res.status(ownership.status).json({ message: ownership.message });
        return;
    }
    Object.assign(pkg, parsed.data);
    await pkg.save();
    res.json(pkg);
}
async function deletePackage(req, res) {
    const pkg = await Package_1.PackageModel.findById(req.params.packageId);
    if (!pkg) {
        res.status(404).json({ message: "Package not found" });
        return;
    }
    const ownership = await verifyResourceOwner(req, pkg.resourceId);
    if (!ownership.ok) {
        res.status(ownership.status).json({ message: ownership.message });
        return;
    }
    pkg.isActive = false;
    await pkg.save();
    res.json(pkg);
}
