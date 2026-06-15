import bcrypt from "bcryptjs";

import { findByEmail, create } from "../repositories/UserRepository";
import { RegisterDto } from "../dto/RegisterDto";
import { ConflictError, NotFoundError, UnauthorizedError } from "../utils/errors";
import { LoginDTO } from "../validators/authValidator";
import jwt from "jsonwebtoken"


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
        return new UnauthorizedError("Invalid credentials");
    }
    if (!user.isActive) {
        return new UnauthorizedError("Account is disabled")
    }


    const token = jwt.sign(
        {
            userId: user.id, role: user.role
        },
        process.env.JWT_SECRET as string,
        {
            expiresIn: "1d"
        }
    )

    const {passwordHash:_, ...safeUser}=user;
    return {user:safeUser, token}

}