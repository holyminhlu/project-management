import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function PATCH(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await context.params;
    const maCongViec = String(taskId || "").trim();
    if (!maCongViec) {
      return NextResponse.json({ error: "Thiếu mã công việc." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("pm_access")?.value;
    if (!accessToken) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";
    const backendResponse = await fetch(`${backendUrl}/tasks/personal/${encodeURIComponent(maCongViec)}/delete`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    const data = await backendResponse.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendResponse.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi máy chủ.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
