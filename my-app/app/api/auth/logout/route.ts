import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverApi } from "@/lib/api/server";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("pm_refresh")?.value;

  try {
    if (refreshToken) {
      await serverApi("auth", "/auth/logout", {
        method: "POST",
        body: { refreshToken },
      });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set("pm_access", "", { path: "/", maxAge: 0 });
    response.cookies.set("pm_refresh", "", { path: "/", maxAge: 0 });
    response.cookies.set("pm_auth", "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi máy chủ.";
    const response = NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Lỗi máy chủ." },
      { status: 500 },
    );
    response.cookies.set("pm_access", "", { path: "/", maxAge: 0 });
    response.cookies.set("pm_refresh", "", { path: "/", maxAge: 0 });
    response.cookies.set("pm_auth", "", { path: "/", maxAge: 0 });
    return response;
  }
}
