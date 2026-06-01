"use strict";

const { connectDB } = require("../config/db");
const { ResourceModel } = require("../models/Resource");
const { ensureResourceSlug, slugifyName, resolveUniqueSlug } = require("../utils/venueSlug");

async function main() {
  await connectDB();
  const resources = await ResourceModel.find({
    $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }],
  });

  for (const resource of resources) {
    const preferred = resource.slug || slugifyName(resource.name) || `venue${resource._id.toString().slice(-6)}`;
    resource.slug = await resolveUniqueSlug(preferred, resource._id);
    await resource.save();
    console.log(`${resource.name} -> /${resource.slug}`);
  }

  console.log(`Backfilled ${resources.length} venue slug(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
