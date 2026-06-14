import bcrypt from "bcryptjs";

import { findByEmail, create } from "../repositories/UserRepository";
import { RegisterDto } from "../dto/RegisterDto";
import { ConflictError } from "../utils/errors";


export const register=async(dto:RegisterDto)=>{

    const existing=await findByEmail(dto.email);
    if(existing){
        throw new ConflictError("Email already registered");
    }

    const passwordHash=await bcrypt.hash(dto.password,10);
    const user=await create({
        firstName:dto.firstName,
        lastName:dto.lastName,
        email:dto.email,
        passwordHash 
    })

    const {passwordHash:_,...safeUser}=user;
    return safeUser;

}