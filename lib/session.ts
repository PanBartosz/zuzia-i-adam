import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { appConfig } from "@/lib/config";

export const sessionCookieName = "zua_session";
const encoder = new TextEncoder();

type SessionPayload = {
  sub: string;
  email: string;
};

function secretKey() {
  return encoder.encode(appConfig.authSecret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretKey());
}

export async function verifySession(token?: string) {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

export async function getRequestSession(request: NextRequest) {
  return verifySession(request.cookies.get(sessionCookieName)?.value);
}

export async function getPageSession() {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(sessionCookieName)?.value);
}
