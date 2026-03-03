import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool from "../../../../lib/db";
import { createAuthCookie } from "../../../../lib/auth";

type EmployeeRow = RowDataPacket & {
  ma_nhan_vien: string;
  ten_nv: string;
  email: string;
  password: string;
  trang_thai_hoat_dong: string | null;
};

function normalizeStatus(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[\s_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "Vui lòng nhập email và mật khẩu." }, { status: 400 });
    }

    const [rows] = await pool.query<EmployeeRow[]>(
      `SELECT ma_nhan_vien, ten_nv, email, password, trang_thai_hoat_dong
       FROM nhan_vien
       WHERE email = ?
       LIMIT 1`,
      [email],
    );

    const employee = rows[0];
    if (!employee) {
      return NextResponse.json({ error: "Tài khoản hoặc mật khẩu không đúng." }, { status: 401 });
    }

    if (employee.password !== password) {
      return NextResponse.json({ error: "Tài khoản hoặc mật khẩu không đúng." }, { status: 401 });
    }

    if (
      employee.trang_thai_hoat_dong &&
      !["active", "hoat_dong", "hoatdong", "1", "true"].includes(
        normalizeStatus(employee.trang_thai_hoat_dong),
      )
    ) {
      return NextResponse.json({ error: "Tài khoản hiện không hoạt động." }, { status: 403 });
    }

    const sessionPayload = await createAuthCookie({
      ma_nhan_vien: employee.ma_nhan_vien,
      email: employee.email,
      ten_nv: employee.ten_nv,
      login_at: Date.now(),
    });

    const response = NextResponse.json({
      message: "Đăng nhập thành công.",
      user: {
        ma_nhan_vien: employee.ma_nhan_vien,
        ten_nv: employee.ten_nv,
        email: employee.email,
      },
    });

    response.cookies.set("pm_auth", sessionPayload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
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
