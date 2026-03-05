import { BACKENDS, BackendName } from "./config";

export type ServerApiResult<T = unknown> = {
  data: T | null;
  status: number;
  ok: boolean;
};

type ServerApiOptions = Omit<RequestInit, "body" | "headers"> & {
  /** Bearer token — được thêm vào header Authorization tự động */
  token?: string;
  /** Request body — tự động serialize thành JSON */
  body?: unknown;
  /** Extra headers bổ sung */
  headers?: Record<string, string>;
};

/**
 * Server-side wrapper gọi backend được đặt tên trong BACKENDS.
 * Dùng trong Next.js API routes và Server Components.
 *
 * @param backend - tên backend: "auth" | "tasks" | "projects"
 * @param path    - đường dẫn API phía backend (e.g. "/auth/me")
 * @param options - tùy chọn fetch + token + body
 */
export async function serverApi<T = unknown>(
  backend: BackendName,
  path: string,
  options: ServerApiOptions = {},
): Promise<ServerApiResult<T>> {
  const { token, body, headers: extraHeaders = {}, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BACKENDS[backend]}${path}`, {
      ...rest,
      headers,
      cache: "no-store",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = (await res.json().catch(() => null)) as T | null;
    return { data, status: res.status, ok: res.ok };
  } catch {
    return { data: null, status: 0, ok: false };
  }
}
