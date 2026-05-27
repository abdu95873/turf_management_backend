import type { Request, Response } from "express";
import { z } from "zod";
import { SlotModel } from "../models/Slot";
import { generateDailySlots } from "../services/slot.service";

const generateSchema = z.object({
  resourceId: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  durationMinutes: z.number().min(15).max(240),
});

export async function generateSlots(req: Request, res: Response): Promise<void> {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const createdCount = await generateDailySlots(parsed.data);
  res.status(201).json({ createdCount });
}

export async function listSlots(req: Request, res: Response): Promise<void> {
  const resourceId = String(req.query.resourceId ?? "");
  const date = String(req.query.date ?? "");

  if (!resourceId || !date) {
    res.status(400).json({ message: "resourceId and date are required" });
    return;
  }

  const slots = await SlotModel.find({ resourceId, date }).sort({ startTime: 1 });
  res.json(slots);
}
