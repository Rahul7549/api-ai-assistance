import { Request, Response, NextFunction } from "express";
import {json, success, ZodError} from "zod";
import {AppError} from "../utils/errors"


export const errorHandler=(
    err:Error,
    req:Request,
    res:Response,
    next:NextFunction

)=>{
    //1. validation error from zod ->400 with field details
    if(err instanceof ZodError){
        return res.status(400).json({
            success:false,
            message:"Validation failed",
            errors:err.issues.map((i)=>({
                field:i.path.join("."),
                message:i.message
            }))
        });
    }

    //2. Our known , expected errors -> use their own status code
    if(err instanceof AppError){
        return res.status(err.statusCode).json({
            success:false,
            message:err.message
        });
    }

    //3. Anything else =an unexpected bug. log it, hide details from client.

    console.error("UNEXPECTED ERROR",err);
    return res.status(500).json({
        success:false,
        message:"Internal server error"
    })
}