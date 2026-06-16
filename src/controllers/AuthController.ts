import { NextFunction, Request, Response } from "express";

import * as authService from '../services/AuthService'
import { success } from "zod";
import { asyncHandler } from "../utils/asyncHandler";


export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await authService.register(req.body);
        res.status(200).json({ success: true, data: user })
    } catch (err: any) {
        // res.status(400).json({success:false, message:err.message})
        next(err)
    }
};


export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await authService.login(req.body);
        console.log("result ", result);

        res.status(200).json({ success: true, data: result })
    } catch (err: any) {
        next(err);
    }

}


export const refresh = asyncHandler(async (req: Request, res: Response,next:NextFunction) => {
    try {
        const result = await authService.refresh(req.body.refreshToken);
        console.log("refresh Token ", result);
        
        res.status(200).json({ success: true, data: result })
    }catch(err:any){
        next();
    }
   
})
