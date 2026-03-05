import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverApi } from "@/lib/api/server";

type UpdateTaskStatusPayload = {
  status_key?: "todo" | "in_progress" | "done" | "deleted";
};

export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await context.params;
    const maCongViec = String(taskId || "").trim();
    if (!maCongViec) {
      return NextResponse.json({ error: "Thiếu mã công việc." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as UpdateTaskStatusPayload;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("pm_access")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const isDeleted = body?.status_key === "deleted";
    const path = isDeleted
      ? `/tasks/personal/${encodeURIComponent(maCongViec)}/delete`
      : `/tasks/personal/${encodeURIComponent(maCongViec)}`;

    const { data, status } = await serverApi("tasks", path, {
      method: "PATCH",
      token: accessToken,
      ...(isDeleted ? {} : { body }),
    });
    return NextResponse.json(data ?? {}, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi máy chủ.";
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Lỗi máy chủ." },
      { status: 500 },
    );
  }
}
