import { NextFunction, Request, Response } from "express";

import * as authService from '../services/AuthService'


export const register=async(req:Request, res:Response,next:NextFunction)=>{
    try{
        const user=await authService.register(req.body);
        res.status(200).json({success:true, data:user})
    }catch(err:any){
        // res.status(400).json({success:false, message:err.message})
        next(err)
    }
};