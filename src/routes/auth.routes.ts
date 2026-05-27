import { Router } from "express";
import {
  googleAuthPlaceholder,
  login,
  logout,
  refreshAccessToken,
  register,
  sendEmailVerificationToken,
  verifyEmail,
} from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuthPlaceholder);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);
router.post("/email/send-verification", requireAuth, sendEmailVerificationToken);
router.post("/email/verify", verifyEmail);

export default router;
