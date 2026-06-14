import { Router } from "express";

import * as authController from "../controllers/AuthController"
import { validate } from "../middleware/validate";
import { registerSchema } from "../validators/authValidator";

const router=Router();

router.post("/register",validate(registerSchema), authController.register);

export default router;