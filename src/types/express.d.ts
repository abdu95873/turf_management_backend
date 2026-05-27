import type { Role } from "../constants/roles";

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      role: Role;
    }

    interface Request {
      user?: UserContext;
    }
  }
}

export {};
