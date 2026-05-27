"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPublicEvents = listPublicEvents;
exports.listManagedEvents = listManagedEvents;
exports.createEvent = createEvent;
exports.updateEvent = updateEvent;
exports.deleteEvent = deleteEvent;
const zod_1 = require("zod");
const Event_1 = require("../models/Event");
const eventSchema = zod_1.z.object({
    title: zod_1.z.string().min(2),
    badge: zod_1.z.string().optional(),
    image: zod_1.z.string().optional(),
    dateLabel: zod_1.z.string().min(2),
    format: zod_1.z.string().optional(),
    prizePool: zod_1.z.string().optional(),
    venue: zod_1.z.string().optional(),
    filled: zod_1.z.coerce.number().min(0).optional(),
    total: zod_1.z.coerce.number().min(1).optional(),
    status: zod_1.z.enum(["draft", "published", "completed"]).optional(),
    isPublished: zod_1.z.boolean().optional(),
});
async function listPublicEvents(_req, res) {
    const events = await Event_1.EventModel.find({ isPublished: true }).sort({ createdAt: -1 });
    res.json(events);
}
async function listManagedEvents(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const filter = req.user.role === "admin" ? {} : { ownerId: req.user.id };
    const events = await Event_1.EventModel.find(filter).sort({ createdAt: -1 });
    res.json(events);
}
async function createEvent(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    if (!["owner", "admin"].includes(req.user.role)) {
        res.status(403).json({ message: "Forbidden" });
        return;
    }
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const payload = parsed.data;
    const isPublished = payload.isPublished ?? payload.status === "published";
    const event = await Event_1.EventModel.create({
        ...payload,
        isPublished,
        status: payload.status ?? (isPublished ? "published" : "draft"),
        ownerId: req.user.role === "admin" ? null : req.user.id,
    });
    res.status(201).json(event);
}
async function updateEvent(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const parsed = eventSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.flatten() });
        return;
    }
    const event = await Event_1.EventModel.findById(req.params.eventId);
    if (!event) {
        res.status(404).json({ message: "Event not found" });
        return;
    }
    if (req.user.role !== "admin" && String(event.ownerId) !== String(req.user.id)) {
        res.status(403).json({ message: "Forbidden" });
        return;
    }
    Object.assign(event, parsed.data);
    if (parsed.data.isPublished !== undefined) {
        event.isPublished = parsed.data.isPublished;
        if (parsed.data.isPublished && event.status === "draft") {
            event.status = "published";
        }
    }
    await event.save();
    res.json(event);
}
async function deleteEvent(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const event = await Event_1.EventModel.findById(req.params.eventId);
    if (!event) {
        res.status(404).json({ message: "Event not found" });
        return;
    }
    if (req.user.role !== "admin" && String(event.ownerId) !== String(req.user.id)) {
        res.status(403).json({ message: "Forbidden" });
        return;
    }
    await event.deleteOne();
    res.json({ message: "Event deleted" });
}
