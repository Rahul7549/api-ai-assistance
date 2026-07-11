import { Request, Response, NextFunction } from "express";
import * as conversationService from "../services/ConversationService";

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await conversationService.create(
      req.user!.userid,
      req.body.assistantId,
      req.body.title
    );
    res.status(201).json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
};

export const listByAssistant = async (req: Request<{ assistantId: string }>, res: Response, next: NextFunction) => {
  try {
    const conversations = await conversationService.listByAssistant(
      req.user!.userid,
      req.params.assistantId
    );
    res.status(200).json({ success: true, data: conversations });
  } catch (err) {
    next(err);
  }
};

export const getMessages = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const messages = await conversationService.getMessages(req.user!.userid, req.params.id);
    res.status(200).json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
};

export const addMessage = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const message = await conversationService.addMessage(
      req.user!.userid,
      req.params.id,
      "USER",
      req.body.content
    );
    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await conversationService.remove(req.user!.userid, req.params.id);
    res.status(200).json({ success: true, message: "Conversation deleted" });
  } catch (err) {
    next(err);
  }
};
