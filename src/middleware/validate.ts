import { Request, Response, NextFunction } from "express";
import {ZodSchema} from "zod";


export const validate=
(schema:ZodSchema)=>
(req:Request,res:Response,next:NextFunction)=>{
    req.body=schema.parse(req.body);
    next();
}