export type ClientApiResult<T = unknown> = {
  data: T | null;
  status: number;
  ok: boolean;
  /** Thông báo lỗi trích xuất từ response body khi !ok */
  error?: string;
};

type ClientApiOptions = {
  method?: string;
  /** Request body — tự động serialize thành JSON */
  body?: unknown;
  /** Extra headers bổ sung */
  headers?: Record<string, string>;
};

/**
 * Client-side wrapper gọi Next.js API routes (/api/...).
 * Dùng trong các "use client" components.
 *
 * @param path    - đường dẫn Next.js API route (e.g. "/api/tasks/personal")
 * @param options - method, body, headers
 */
export async function clientApi<T = unknown>(
  path: string,
  options: ClientApiOptions = {},
): Promise<ClientApiResult<T>> {
  const { method = "GET", body, headers = {} } = options;

  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = (await res.json().catch(() => null)) as T | null;
    const error = !res.ok
      ? ((data as { error?: string } | null)?.error ?? "Lỗi không xác định.")
      : undefined;
    return { data, status: res.status, ok: res.ok, error };
  } catch {
    return { data: null, status: 0, ok: false, error: "Không thể kết nối máy chủ." };
  }
}
