import { NextResponse } from "next/server";

type BackendLoginResponse = {
  message?: string;
  user?: {
    ma_nhan_vien: string;
    ten_nv: string;
    email: string;
  };
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "Vui lòng nhập email và mật khẩu." }, { status: 400 });
    }

    const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";
    const backendResponse = await fetch(`${backendUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    const data = (await backendResponse
      .json()
      .catch(() => ({}))) as BackendLoginResponse;

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: data.error ?? "Đăng nhập thất bại." },
        { status: backendResponse.status },
      );
    }

    if (!data.accessToken || !data.refreshToken || !data.user) {
      return NextResponse.json({ error: "Phản hồi đăng nhập không hợp lệ." }, { status: 502 });
    }

    const accessMaxAge = typeof data.expiresIn === "number" ? data.expiresIn : 60 * 15;
    const refreshMaxAge = 60 * 60 * 24 * 7;

    const response = NextResponse.json({
      message: data.message ?? "Đăng nhập thành công.",
      user: data.user,
    });

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

    // Remove legacy cookie if it exists.
    response.cookies.set("pm_auth", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi máy chủ khi đăng nhập.";
    return NextResponse.json(
      {
        error: process.env.NODE_ENV === "development" ? message : "Lỗi máy chủ khi đăng nhập.",
      },
      { status: 500 },
    );
  }
}
