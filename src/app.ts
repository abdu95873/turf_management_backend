import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.routes";
import bookingRoutes from "./routes/booking.routes";
import resourceRoutes from "./routes/resource.routes";
import slotRoutes from "./routes/slot.routes";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/bookings", bookingRoutes);
