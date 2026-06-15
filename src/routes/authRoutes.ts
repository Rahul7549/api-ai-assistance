import { Router } from "express";

import * as authController from "../controllers/AuthController"
import { validate } from "../middleware/validate";
import { loginSchema, registerSchema } from "../validators/authValidator";

const router=Router();

router.post("/register",validate(registerSchema), authController.register);
router.post("/login",validate(loginSchema),authController.login);

export default router;