import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type CreateProjectPayload = {
  ten_du_an?: string;
  ma_phong_ban?: string;
  mo_ta?: string;
  ngay_bat_dau?: string;
  ngay_ket_thuc?: string;
  ngay_tao_du_an?: string;
  thiet_lap_trien_khai?: number;
  thiet_lap_den_han?: number;
  muc_do_uu_tien?: string;
  member_ids?: string[];
};

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("pm_access")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const requestUrl = new URL(request.url);
    const isSetup = requestUrl.searchParams.get("setup") === "1";
    const targetPath = isSetup ? "/projects/personal/setup" : "/projects/personal";
    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";
    const backendResponse = await fetch(`${backendUrl}${targetPath}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const data = await backendResponse.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendResponse.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi máy chủ.";
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Lỗi máy chủ." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateProjectPayload;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("pm_access")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";
    const backendResponse = await fetch(`${backendUrl}/projects/personal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await backendResponse.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendResponse.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi máy chủ.";
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Lỗi máy chủ." },
      { status: 500 },
    );
  }
}
