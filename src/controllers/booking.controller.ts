import type { Request, Response } from "express";
import { z } from "zod";
import { BookingModel } from "../models/Booking";
import { SlotModel } from "../models/Slot";
import { createBookingAtomic } from "../services/booking.service";

const createBookingSchema = z.object({
  slotId: z.string(),
  idempotencyKey: z.string().min(8),
});

export async function createBooking(req: Request, res: Response): Promise<void> {
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
    const booking = await createBookingAtomic({
      userId: req.user.id,
      slotId: parsed.data.slotId,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    res.status(201).json(booking);
  } catch (error) {
    res.status(409).json({ message: error instanceof Error ? error.message : "Booking failed" });
  }
}

export async function listMyBookings(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const bookings = await BookingModel.find({ userId: req.user.id }).sort({ createdAt: -1 });
  res.json(bookings);
}

export async function cancelMyBooking(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const bookingId = req.params.bookingId;
  const booking = await BookingModel.findOne({
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
  await SlotModel.findByIdAndUpdate(booking.slotId, { $set: { status: "available" } });

  res.json({ message: "Booking cancelled successfully" });
}
