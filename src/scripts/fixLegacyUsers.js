"use strict";

const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const { UserModel } = require("../models/User");

async function main() {
  await connectDB();
  const result = await UserModel.updateMany(
    { isActive: { $exists: false } },
    { $set: { isActive: true } }
  );
  console.log(`Updated ${result.modifiedCount} user(s) missing isActive.`);
}

main()
  .catch((error) => {
    console.error("Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
