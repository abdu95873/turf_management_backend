"use strict";

const mongoose = require("mongoose");
const { connectDB } = require("../config/db");

const email = process.argv[2];
const passwordHash = process.argv[3];
const name = process.argv[4] ?? email?.split("@")[0] ?? "User";

if (!email || !passwordHash) {
  console.error("Usage: node src/scripts/importUser.js <email> <passwordHash> [name]");
  process.exit(1);
}

async function main() {
  await connectDB();
  const users = mongoose.connection.db.collection("users");
  await users.updateOne(
    { email: email.toLowerCase() },
    {
      $set: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        authProvider: "local",
        emailVerified: false,
        role: "user",
        isActive: true,
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  const user = await users.findOne({ email: email.toLowerCase() });
  console.log(`User ready: ${user.email} (${user._id})`);
}

main()
  .catch((error) => {
    console.error("Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
