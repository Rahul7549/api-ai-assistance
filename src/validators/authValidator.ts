import {z} from "zod";

export const registerSchema=z.object({
    firstName:z.string().min(1, "first name is required").max(50),
    lastName:z.string().min(1, "Last name is required").max(50),
    email:z.string().email("Invalid email address"),
    password:z.string().min(8, "Password must be at least 8 characters").max(16)
})

export  const loginSchema=z.object({
    email:z.string().email("Invalid email address"),
    password:z.string().min(1, "Password is required")
})


export const refreshSchema=z.object({
    refreshToken:z.string().min(1, "Refresh token is required")
});


export type RegisterDto=z.infer<typeof registerSchema>;
export type LoginDTO=z.infer<typeof loginSchema>;
export type RefreshDto=z.infer<typeof refreshSchema>

