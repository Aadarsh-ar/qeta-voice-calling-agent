import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "theaaadarsh15@gmail.com";
const ADMIN_PASSWORD = "Aadarsh@15";
const SESSION_COOKIE = "qeta_session";
const SESSION_TOKEN = "qeta_admin_authenticated_v1";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const emailMatch = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const passMatch = password === ADMIN_PASSWORD;

    if (!emailMatch || !passMatch) {
      await new Promise((r) => setTimeout(r, 300));
      return NextResponse.json(
        { success: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true, redirectTo: "/dashboard" });

    response.cookies.set(SESSION_COOKIE, SESSION_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Server error during authentication." },
      { status: 500 }
    );
  }
}
