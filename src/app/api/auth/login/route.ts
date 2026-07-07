import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import {
  createSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const hash = process.env.APP_PASSWORD_HASH ?? "";

  const valid = hash ? await verifyPassword(password, hash) : false;

  if (!valid) {
    return NextResponse.redirect(new URL("/login?error=1", request.url));
  }

  const token = await createSessionCookie();
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
