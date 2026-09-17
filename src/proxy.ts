import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "qeta_session";
const SESSION_TOKEN = "qeta_admin_authenticated_v1";

// Routes that require authentication
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/agents",
  "/calls",
  "/analytics",
  "/settings",
  "/phone-numbers",
  "/billing",
  "/integrations",
  "/leads",
  "/performance",
  "/employees",
  "/training",
  "/calling",
];

// Public API routes and internals
const PUBLIC_PREFIXES = ["/api/auth", "/api/vobiz", "/_next", "/favicon", "/api/"];
// Public pages
const PUBLIC_EXACT = ["/", "/login", "/signup", "/pricing", "/templates"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow Next.js internals and all API routes (protected at route level if needed)
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow public exact routes
  if (PUBLIC_EXACT.includes(pathname)) {
    return NextResponse.next();
  }

  // Check if this is a protected route
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // Validate session cookie
  const session = request.cookies.get(SESSION_COOKIE);
  if (!session || session.value !== SESSION_TOKEN) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
