import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function hasValidAccessToken(accessToken: string, backendUrl: string) {
  try {
    const response = await fetch(`${backendUrl}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("pm_access")?.value;
  const refreshToken = request.cookies.get("pm_refresh")?.value;

  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";
  const isProtectedRoute = pathname.startsWith("/home") || pathname.startsWith("/profile");
  const isLoggedIn = accessToken ? await hasValidAccessToken(accessToken, backendUrl) : false;

  if (pathname === "/" && isLoggedIn) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  if (isProtectedRoute && isLoggedIn) {
    return NextResponse.next();
  }

  // If access token is missing/expired but refresh token exists, try to refresh once.
  if (isProtectedRoute && refreshToken) {
    try {
      const refreshResponse = await fetch(`${backendUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });

      const data = (await refreshResponse
        .json()
        .catch(() => ({}))) as {
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
        refreshExpiresIn?: number;
      };

      if (refreshResponse.ok && data.accessToken && data.refreshToken) {
        const response = NextResponse.next();
        const accessMaxAge = typeof data.expiresIn === "number" ? data.expiresIn : 60 * 15;
        const refreshMaxAge = typeof data.refreshExpiresIn === "number" ? data.refreshExpiresIn : 60 * 60 * 24 * 7;

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
    } catch {
      // Backend unavailable or network error. Fall through to redirect.
    }
  }

  if (isProtectedRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/home/:path*", "/profile/:path*"],
};
