import { createHash, randomBytes } from "node:crypto";

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function createInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidInviteToken(token: string) {
  return tokenPattern.test(token);
}
