import { Router } from "express";
import * as assistantController from "../controllers/AssistantController";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { createAssistantSchema, updateAssistantSchema } from "../validators/assistantValidator";

const router = Router();

router.use(authenticate);

router.post("/", validate(createAssistantSchema), assistantController.create);
router.get("/", assistantController.list);
router.get("/:id", assistantController.getById);
router.put("/:id", validate(updateAssistantSchema), assistantController.update);
router.delete("/:id", assistantController.remove);

export default router;
