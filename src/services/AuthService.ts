import bcrypt from "bcryptjs";

import { findByEmail, create } from "../repositories/UserRepository";
import { RegisterDto } from "../dto/RegisterDto";
import { ConflictError, NotFoundError, UnauthorizedError } from "../utils/errors";
import { LoginDTO } from "../validators/authValidator";
import jwt from "jsonwebtoken"
import { Role } from "@prisma/client";
import { generateRefreshToken, hashToken } from "../utils/token";
import * as refreshTokenRepository from "../repositories/RefreshTokenRepository";

const REFRESH_TOKEN_DAYS=7;


export const register = async (dto: RegisterDto) => {

    const existing = await findByEmail(dto.email);
    if (existing) {
        throw new ConflictError("Email already registered");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash
    })

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;

}


export const login = async (dto: LoginDTO) => {
    const user = await findByEmail(dto.email);

    if (!user) {
        throw new UnauthorizedError("Invalid credentials");
    }
    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
        throw new UnauthorizedError("Invalid credentials");
    }
    if (!user.isActive) {
        throw new UnauthorizedError("Account is disabled")
    }

    const token =await issueToken(user);


    // const token = jwt.sign(
    //     {
    //         userId: user.id, role: user.role
    //     },
    //     process.env.JWT_ACCESS_SECRET as string,
    //     {
    //         expiresIn: "1d"
    //     }
    // )

    const {passwordHash:_, ...safeUser}=user;
    return {user:safeUser, token}

}


const issueToken=async(user:{id:string;role:Role})=>{
    const accessToken=jwt.sign(
        {userid:user.id,role:user.role},
        process.env.JWT_ACCESS_SECRET as string,
        {expiresIn:"15m"}
    );



    const {raw,hashed}=generateRefreshToken();
    const expiresAt=new Date();
    expiresAt.setDate(expiresAt.getDate()+REFRESH_TOKEN_DAYS);


    await refreshTokenRepository.create({
        token:hashed,
        userId:user.id,
        expiresAt

    });

    return {accessToken,refreshToken:raw};

}


export const refresh=async (refreshToken:string)=>{
    const hashed=hashToken(refreshToken);
    const stored=await refreshTokenRepository.findByToken(hashed);


    if(!stored || stored.revoked || stored.expiresAt <new Date){
        throw new UnauthorizedError("Invalid refresh token");
    }


    await refreshTokenRepository.revoke(stored.id);

    const user=await refreshTokenRepository.findById(stored.id);

    if(!user || !user.isActive){
        throw new UnauthorizedError("Invalid refresh token");
    }
    return issueToken(user);

}