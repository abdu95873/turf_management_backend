"use strict";

const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const { UserModel } = require("../models/User");
const { ResourceModel } = require("../models/Resource");
const { SlotModel } = require("../models/Slot");
const { BookingModel } = require("../models/Booking");
const { PaymentModel } = require("../models/Payment");
const { ReviewModel } = require("../models/Review");
const { PlatformSettingModel } = require("../models/PlatformSetting");
const { RefreshTokenModel } = require("../models/RefreshToken");
const { IdempotencyRecordModel } = require("../models/IdempotencyRecord");
const { WebhookEventLogModel } = require("../models/WebhookEventLog");
const { WebhookNonceModel } = require("../models/WebhookNonce");
const { hashPassword } = require("../utils/password");
const { ROLES } = require("../constants/roles");
const { slugifyName } = require("../utils/venueSlug");

const ITEM_COUNT = 5;

function makeId(prefix, index, runId) {
  return `${prefix}-${runId}-${index + 1}`;
}

async function main() {
  const runId = Date.now().toString();
  await connectDB();

  const passwordHash = await hashPassword("Demo12345!");
  const now = new Date();

  const owners = await UserModel.insertMany(
    Array.from({ length: ITEM_COUNT }, (_, index) => ({
      name: `Demo Owner ${index + 1}`,
      email: `${makeId("owner", index, runId)}@demo.local`,
      passwordHash,
      role: ROLES.OWNER,
      emailVerified: true,
      isActive: true,
    }))
  );

  const users = await UserModel.insertMany(
    Array.from({ length: ITEM_COUNT }, (_, index) => ({
      name: `Demo User ${index + 1}`,
      email: `${makeId("user", index, runId)}@demo.local`,
      passwordHash,
      role: ROLES.USER,
      emailVerified: index % 2 === 0,
      isActive: true,
    }))
  );

  const resources = await ResourceModel.insertMany(
    Array.from({ length: ITEM_COUNT }, (_, index) => ({
      name: `Demo Resource ${index + 1}`,
      slug: `${slugifyName(`Demo Resource ${index + 1}`)}${index + 1}`,
      type: ["turf", "pool", "sports"][index % 3],
      ownerId: owners[index]._id,
      locationName: `Dhaka Zone ${index + 1}`,
      location: {
        type: "Point",
        coordinates: [90.38 + index * 0.01, 23.75 + index * 0.01],
      },
      facilities: ["parking", "lights", "washroom"],
      images: [`https://picsum.photos/seed/${makeId("resource", index, runId)}/800/500`],
      pricePerHour: 1000 + index * 250,
      isActive: true,
    }))
  );

  const bookingDate = "2026-04-30";
  const slots = await SlotModel.insertMany(
    Array.from({ length: ITEM_COUNT }, (_, index) => ({
      resourceId: resources[index]._id,
      date: bookingDate,
      startTime: `${String(6 + index).padStart(2, "0")}:00`,
      endTime: `${String(7 + index).padStart(2, "0")}:00`,
      status: "booked",
      generatedByRule: false,
    }))
  );

  const bookings = await BookingModel.insertMany(
    Array.from({ length: ITEM_COUNT }, (_, index) => ({
      userId: users[index]._id,
      resourceId: resources[index]._id,
      slotId: slots[index]._id,
      bookingDate,
      startTime: slots[index].startTime,
      endTime: slots[index].endTime,
      amount: resources[index].pricePerHour,
      commission: Math.round(resources[index].pricePerHour * 0.1),
      bookingStatus: index % 2 === 0 ? "confirmed" : "pending",
      paymentStatus: index % 2 === 0 ? "paid" : "manual_pending",
      idempotencyKey: makeId("booking-idempotency", index, runId),
    }))
  );

  await PaymentModel.insertMany(
    Array.from({ length: ITEM_COUNT }, (_, index) => ({
      bookingId: bookings[index]._id,
      userId: users[index]._id,
      amount: bookings[index].amount,
      provider: index % 2 === 0 ? "bkash" : "sslcommerz",
      status: index % 2 === 0 ? "paid" : "initiated",
      transactionId: makeId("tx", index, runId),
      providerPaymentId: makeId("provider-pay", index, runId),
      gatewayPayload: { source: "demo-seed", runId },
    }))
  );

  await ReviewModel.insertMany(
    Array.from({ length: ITEM_COUNT }, (_, index) => ({
      userId: users[index]._id,
      resourceId: resources[index]._id,
      rating: (index % 5) + 1,
      comment: `Demo review ${index + 1} for seeded resource`,
    }))
  );

  await PlatformSettingModel.insertMany(
    Array.from({ length: ITEM_COUNT }, (_, index) => ({
      key: makeId("demo-setting", index, runId),
      commissionRate: 8 + index,
    }))
  );

  await RefreshTokenModel.insertMany(
    Array.from({ length: ITEM_COUNT }, (_, index) => ({
      userId: users[index]._id,
      tokenHash: crypto.createHash("sha256").update(makeId("refresh-token", index, runId)).digest("hex"),
      expiresAt: new Date(now.getTime() + (index + 7) * 24 * 60 * 60 * 1000),
      revokedAt: null,
    }))
  );

  await IdempotencyRecordModel.insertMany(
    Array.from({ length: ITEM_COUNT }, (_, index) => ({
      key: makeId("request-key", index, runId),
      scope: "demo.seed",
      requestHash: crypto.createHash("sha256").update(makeId("request-body", index, runId)).digest("hex"),
      statusCode: 201,
      responseBody: { ok: true, index, runId },
      expiresAt: new Date(now.getTime() + (index + 1) * 60 * 60 * 1000),
    }))
  );

  await WebhookEventLogModel.insertMany(
    Array.from({ length: ITEM_COUNT }, (_, index) => ({
      provider: index % 2 === 0 ? "bkash" : "sslcommerz",
      eventType: "payment.completed",
      eventId: makeId("event", index, runId),
      signatureValid: true,
      nonceUsed: makeId("nonce", index, runId),
      processingStatus: "accepted",
      message: "Seeded webhook log",
      payload: { demo: true, runId, index },
    }))
  );

  await WebhookNonceModel.insertMany(
    Array.from({ length: ITEM_COUNT }, (_, index) => ({
      provider: index % 2 === 0 ? "bkash" : "sslcommerz",
      nonce: makeId("nonce", index, runId),
      expiresAt: new Date(now.getTime() + (index + 2) * 30 * 60 * 1000),
    }))
  );

  console.log("Demo data inserted successfully.");
  console.log(`Inserted ${ITEM_COUNT} documents in each collection.`);
  console.log(`Run ID: ${runId}`);
}

main()
  .catch((error) => {
    console.error("Failed to seed demo data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
