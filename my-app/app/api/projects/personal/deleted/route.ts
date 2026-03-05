import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get("pm_access")?.value;

        if (!accessToken) {
            return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
        }

        const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";
        const backendResponse = await fetch(`${backendUrl}/projects/personal/deleted`, {
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
