import mongoose from "mongoose";
import { BookingModel } from "../models/Booking";
import { ResourceModel } from "../models/Resource";
import { SlotModel } from "../models/Slot";

interface CreateBookingInput {
  userId: string;
  slotId: string;
  idempotencyKey: string;
}

export async function createBookingAtomic(input: CreateBookingInput) {
  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      const existing = await BookingModel.findOne({
        idempotencyKey: input.idempotencyKey,
      }).session(session);

      if (existing) {
        return existing;
      }

      const slot = await SlotModel.findOneAndUpdate(
        { _id: input.slotId, status: "available" },
        { $set: { status: "booked" } },
        { new: true, session }
      );

      if (!slot) {
        throw new Error("Slot unavailable or already booked");
      }

      const resource = await ResourceModel.findById(slot.resourceId).session(session);
      if (!resource) {
        throw new Error("Resource not found");
      }

      const booking = await BookingModel.create(
        [
          {
            userId: input.userId,
            resourceId: slot.resourceId,
            slotId: slot._id,
            bookingDate: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            amount: resource.pricePerHour,
            commission: 0,
            bookingStatus: "pending",
            paymentStatus: "manual_pending",
            idempotencyKey: input.idempotencyKey,
          },
        ],
        { session }
      );

      return booking[0];
    });
  } finally {
    await session.endSession();
  }
}
