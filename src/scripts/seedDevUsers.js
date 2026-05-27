"use strict";

const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const { UserModel } = require("../models/User");
const { hashPassword } = require("../utils/password");
const { ROLES } = require("../constants/roles");

const DEV_PASSWORD = "Demo12345!";

const DEV_ACCOUNTS = [
  { name: "Dev User", email: "user@demo.local", role: ROLES.USER },
  { name: "Dev Owner", email: "owner@demo.local", role: ROLES.OWNER },
  { name: "Dev Admin", email: "admin@demo.local", role: ROLES.ADMIN },
];

async function main() {
  await connectDB();
  const passwordHash = await hashPassword(DEV_PASSWORD);

  for (const account of DEV_ACCOUNTS) {
    const email = account.email.toLowerCase();
    await UserModel.findOneAndUpdate(
      { email },
      {
        $set: {
          name: account.name,
          passwordHash,
          role: account.role,
          emailVerified: true,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`  ${account.role.padEnd(6)} ${email}`);
  }

  console.log("\nDev accounts ready. Password for all:", DEV_PASSWORD);
}

main()
  .catch((error) => {
    console.error("Failed to seed dev users:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
