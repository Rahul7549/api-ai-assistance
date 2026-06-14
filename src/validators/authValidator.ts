import {z} from "zod";

export const registerSchema=z.object({
    firstName:z.string().min(1, "first name is required").max(50),
    lastName:z.string().min(1, "Last name is required").max(50),
    email:z.string().email("Invalid email address"),
    password:z.string().min(8, "Password must be at least 8 characters").max(16)
})

export type RegisterDto=z.infer<typeof registerSchema>