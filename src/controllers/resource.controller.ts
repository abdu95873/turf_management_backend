import type { Request, Response } from "express";
import { z } from "zod";
import { ResourceModel } from "../models/Resource";

const createResourceSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["turf", "pool", "sports"]),
  locationName: z.string().min(2),
  longitude: z.number(),
  latitude: z.number(),
  facilities: z.array(z.string()).default([]),
  images: z.array(z.string().url()).default([]),
  pricePerHour: z.number().nonnegative(),
});

export async function createResource(req: Request, res: Response): Promise<void> {
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

  const resource = await ResourceModel.create({
    name: data.name,
    type: data.type,
    ownerId: req.user.id,
    locationName: data.locationName,
    location: { type: "Point", coordinates: [data.longitude, data.latitude] },
    facilities: data.facilities,
    images: data.images,
    pricePerHour: data.pricePerHour,
  });

  res.status(201).json(resource);
}

export async function listResources(req: Request, res: Response): Promise<void> {
  const city = req.query.city ? String(req.query.city) : undefined;
  const query = city ? { locationName: new RegExp(city, "i"), isActive: true } : { isActive: true };

  const resources = await ResourceModel.find(query).sort({ createdAt: -1 });
  res.json(resources);
}
