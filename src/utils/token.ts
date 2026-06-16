import crypto, { hash } from 'crypto';

export const generateRefreshToken=()=>{
    const raw=crypto.randomBytes(40).toString("hex");
    const hashed=crypto.createHash("sha256").update(raw).digest("hex");
    return {raw,hashed}
}

export const hashToken = (raw: string) => {
  return crypto.createHash("sha256").update(raw).digest("hex");
};