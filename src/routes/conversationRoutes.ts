import { Router } from "express";
import * as conversationController from "../controllers/ConversationController";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { createConversationSchema, sendMessageSchema, editMessageSchema } from "../validators/conversationValidator";

const router = Router();

router.use(authenticate);

router.post("/", validate(createConversationSchema), conversationController.create);
router.get("/assistant/:assistantId", conversationController.listByAssistant);
router.get("/:id/messages", conversationController.getMessages);
router.post("/:id/messages", validate(sendMessageSchema), conversationController.addMessage);
router.put("/:id/messages/:messageId", validate(editMessageSchema), conversationController.editMessage);
router.delete("/:id/messages/:messageId", conversationController.removeMessage);
router.delete("/:id", conversationController.remove);

export default router;
