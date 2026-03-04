import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwtHs256 } from "./lib/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("pm_access")?.value;
  const refreshToken = request.cookies.get("pm_refresh")?.value;

  const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-secret";
  const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";

  const payload = accessToken ? await verifyJwtHs256(accessToken, accessSecret) : null;
  const isLoggedIn = Boolean(payload);

  if (pathname === "/" && isLoggedIn) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  if ((pathname.startsWith("/home") || pathname.startsWith("/profile")) && isLoggedIn) {
    return NextResponse.next();
  }

  // If access token is missing/expired but refresh token exists, try to refresh once.
  if ((pathname.startsWith("/home") || pathname.startsWith("/profile")) && refreshToken) {
    const refreshResponse = await fetch(`${backendUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });

    const data = (await refreshResponse
      .json()
      .catch(() => ({}))) as { accessToken?: string; refreshToken?: string; expiresIn?: number };

    if (refreshResponse.ok && data.accessToken && data.refreshToken) {
      const response = NextResponse.next();
      const accessMaxAge = typeof data.expiresIn === "number" ? data.expiresIn : 60 * 15;
      const refreshMaxAge = 60 * 60 * 24 * 7;

      response.cookies.set("pm_access", data.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: accessMaxAge,
      });
      response.cookies.set("pm_refresh", data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: refreshMaxAge,
      });
      response.cookies.set("pm_auth", "", { path: "/", maxAge: 0 });
      return response;
    }
  }

  if (pathname.startsWith("/home") || pathname.startsWith("/profile")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/home/:path*", "/profile/:path*"],
};
