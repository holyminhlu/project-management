import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverApi } from "@/lib/api/server";

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

    const { data, status } = await serverApi("tasks", "/tasks/personal", {
      method: "POST",
      token: accessToken,
      body,
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
