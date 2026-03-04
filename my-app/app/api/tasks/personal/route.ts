import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type CreateTaskPayload = {
  ma_du_an?: string;
  tieu_de?: string;
  mo_ta?: string;
  do_uu_tien?: string;
  han_hoan_thanh?: string | null;
  status_key?: "todo" | "in_progress" | "done";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateTaskPayload;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("pm_access")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";
    const backendResponse = await fetch(`${backendUrl}/tasks/personal`, {
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
