import { NextFunction, Request, Response } from "express";

import * as authService from '../services/AuthService'


export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await authService.register(req.body);
        res.status(200).json({ success: true, data: user })
    } catch (err: any) {
        next(err)
    }
};


export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await authService.login(req.body);
        res.status(200).json({ success: true, data: result })
    } catch (err: any) {
        next(err);
    }

}


export const refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await authService.refresh(req.body.refreshToken);
        res.status(200).json({ success: true, data: result })
    } catch (err: any) {
        next(err);
    }
}

export const logout = async (req: Request, res: Response) => {
  await authService.logout(req.body.refreshToken);
  res.status(200).json({ success: true, message: "Logged out successfully" });
};


