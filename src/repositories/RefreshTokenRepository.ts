import prisma from "../config/prisma";

export const create=(data:{
    token:string;
    userId:string;
    expiresAt:Date;
})=>{
    return prisma.refreshToken.create({data});
}

export const findByToken=(token:string)=>{
    return prisma.refreshToken.findUnique({where:{token}})
}

export const revoke=(id:string)=>{
    return prisma.refreshToken.update({
        where:{id},
        data:{revoked:true}
    })
}

export const findById = (id: string) => {
  return prisma.user.findUnique({ where: { id } });
};