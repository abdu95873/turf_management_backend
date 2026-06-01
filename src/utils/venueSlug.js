"use strict";

const { ResourceModel } = require("../models/Resource");

const RESERVED_SLUGS = new Set([
  "about",
  "account",
  "admin",
  "api",
  "auth",
  "categories",
  "company",
  "contact",
  "discover",
  "events",
  "health",
  "home",
  "login",
  "owner",
  "payment",
  "register",
  "register-owner",
  "staff",
  "user",
  "venue",
]);

function slugifyName(name) {
  const base = String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 48);
  return base.length >= 3 ? base : "";
}

function normalizeSlugInput(value) {
  const base = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 48);
  return base.length >= 3 ? base : "";
}

function isReservedSlug(slug) {
  return RESERVED_SLUGS.has(String(slug || "").toLowerCase());
}

function isObjectId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ""));
}

async function resolveUniqueSlug(preferred, excludeId) {
  let base = normalizeSlugInput(preferred) || "venue";
  if (isReservedSlug(base)) {
    base = `${base}venue`;
  }

  let candidate = base;
  let suffix = 2;

  while (true) {
    const query = { slug: candidate };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const existing = await ResourceModel.findOne(query).select("_id");
    if (!existing) {
      return candidate;
    }
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
}

async function ensureResourceSlug(resource) {
  if (!resource) return resource;
  if (resource.slug) return resource;

  const slug = await resolveUniqueSlug(slugifyName(resource.name) || `venue${resource._id.toString().slice(-6)}`, resource._id);
  resource.slug = slug;
  await resource.save();
  return resource;
}

async function findResourceByIdOrSlug(param) {
  if (!param) return null;

  if (isObjectId(param)) {
    const byId = await ResourceModel.findById(param);
    if (byId) {
      return ensureResourceSlug(byId);
    }
    return null;
  }

  const normalized = normalizeSlugInput(param);
  if (!normalized || isReservedSlug(normalized)) {
    return null;
  }

  let bySlug = await ResourceModel.findOne({ slug: normalized, isActive: true });
  if (bySlug) return bySlug;

  bySlug = await ResourceModel.findOne({ slug: normalized });
  if (bySlug) return ensureResourceSlug(bySlug);

  return null;
}

module.exports = {
  RESERVED_SLUGS,
  slugifyName,
  normalizeSlugInput,
  isReservedSlug,
  isObjectId,
  resolveUniqueSlug,
  ensureResourceSlug,
  findResourceByIdOrSlug,
};
