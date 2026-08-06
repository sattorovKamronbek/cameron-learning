import express from "express";
import { register, validateRegister, login, validateLogin, logout, verifyEmail, refreshToken } from "../controllers/authController";

const router = express.Router();

router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.post("/logout", logout);
router.get("/verify-email", verifyEmail);
router.post("/refresh", refreshToken);

export default router;
