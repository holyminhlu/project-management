import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAuthCookie } from "./lib/auth";

export function middleware(request: NextRequest) {
  const rawToken = request.cookies.get("pm_auth")?.value;
  const isLoggedInPromise = rawToken ? verifyAuthCookie(rawToken) : Promise.resolve(false);
  const { pathname } = request.nextUrl;

  return isLoggedInPromise.then((isLoggedIn) => {
    if (pathname.startsWith("/home") && !isLoggedIn) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (pathname === "/" && isLoggedIn) {
      return NextResponse.redirect(new URL("/home", request.url));
    }

    return NextResponse.next();
  });
}

export const config = {
  matcher: ["/", "/home/:path*"],
};
