import { SlotModel } from "../models/Slot";
import { addMinutes, toMinutes } from "../utils/time";

interface GenerateSlotsInput {
  resourceId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export async function generateDailySlots(input: GenerateSlotsInput): Promise<number> {
  const { resourceId, date, startTime, endTime, durationMinutes } = input;

  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  if (endMinutes <= startMinutes || durationMinutes <= 0) {
    throw new Error("Invalid slot range or duration");
  }

  const bulk: Array<{ updateOne: { filter: object; update: object; upsert: boolean } }> = [];

  for (let current = startMinutes; current + durationMinutes <= endMinutes; current += durationMinutes) {
    const slotStart = `${Math.floor(current / 60).toString().padStart(2, "0")}:${(current % 60)
      .toString()
      .padStart(2, "0")}`;
    const slotEnd = addMinutes(slotStart, durationMinutes);

    bulk.push({
      updateOne: {
        filter: { resourceId, date, startTime: slotStart },
        update: {
          $setOnInsert: {
            resourceId,
            date,
            startTime: slotStart,
            endTime: slotEnd,
            status: "available",
            generatedByRule: true,
          },
        },
        upsert: true,
      },
    });
  }

  if (bulk.length === 0) {
    return 0;
  }

  const result = await SlotModel.bulkWrite(bulk, { ordered: false });
  return result.upsertedCount ?? 0;
}
