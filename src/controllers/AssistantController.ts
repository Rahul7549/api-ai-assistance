import { Request, Response, NextFunction } from "express";
import * as assistantService from "../services/AssistantService";

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assistant = await assistantService.create(req.user!.userid, req.body);
    res.status(201).json({ success: true, data: assistant });
  } catch (err) {
    next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assistants = await assistantService.listByUser(req.user!.userid);
    res.status(200).json({ success: true, data: assistants });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const assistant = await assistantService.getById(req.user!.userid, req.params.id);
    res.status(200).json({ success: true, data: assistant });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const assistant = await assistantService.update(req.user!.userid, req.params.id, req.body);
    res.status(200).json({ success: true, data: assistant });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await assistantService.remove(req.user!.userid, req.params.id);
    res.status(200).json({ success: true, message: "Assistant deleted" });
  } catch (err) {
    next(err);
  }
};
