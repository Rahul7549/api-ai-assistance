import { Router } from "express";

import * as authController from "../controllers/AuthController"
import { validate } from "../middleware/validate";
import { loginSchema, refreshSchema, registerSchema } from "../validators/authValidator";

const router=Router();

router.post("/register",validate(registerSchema), authController.register);
router.post("/login",validate(loginSchema),authController.login);
router.post("/refresh",validate(refreshSchema),authController.refresh);
router.post("/logout", validate(refreshSchema), authController.logout);

export default router;