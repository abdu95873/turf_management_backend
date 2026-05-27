export const ROLES = {
  USER: "user",
  OWNER: "owner",
  ADMIN: "admin",
  STAFF: "staff",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
