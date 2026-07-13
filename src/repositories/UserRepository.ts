import prisma from "../config/prisma";

export const findByEmail = (email: string) => {
    return prisma.user.findUnique({
        where: { email }
    });
};

export const create = (data: {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
}) => {
    return prisma.user.create({ data });
};
