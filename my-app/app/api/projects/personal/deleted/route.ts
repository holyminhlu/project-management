import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverApi } from "@/lib/api/server";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get("pm_access")?.value;

        if (!accessToken) {
            return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
        }

        const { data, status } = await serverApi("projects", "/projects/personal/deleted", { token: accessToken });
        return NextResponse.json(data ?? {}, { status });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Lỗi máy chủ.";
        return NextResponse.json(
            { error: process.env.NODE_ENV === "development" ? message : "Lỗi máy chủ." },
            { status: 500 },
        );
    }
}
