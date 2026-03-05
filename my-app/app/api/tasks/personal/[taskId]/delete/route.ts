import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverApi } from "@/lib/api/server";

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

    const { data, status } = await serverApi(
      "tasks",
      `/tasks/personal/${encodeURIComponent(maCongViec)}/delete`,
      { method: "PATCH", token: accessToken },
    );
    return NextResponse.json(data ?? {}, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi máy chủ.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
