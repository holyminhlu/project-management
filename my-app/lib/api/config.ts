/**
 * Multi-backend configuration.
 *
 * Khi chỉ dùng 1 server: chỉ cần đặt BACKEND_URL.
 * Khi dùng nhiều server riêng biệt, đặt các biến theo từng dịch vụ:
 *
 *   BACKEND_AUTH_URL     — dịch vụ xác thực (auth)
 *   BACKEND_TASKS_URL    — dịch vụ quản lý công việc
 *   BACKEND_PROJECTS_URL — dịch vụ quản lý dự án
 *
 * Nếu biến riêng không được đặt, fallback về BACKEND_URL.
 */
export const BACKENDS = {
  auth: process.env.BACKEND_AUTH_URL ?? process.env.BACKEND_URL ?? "http://127.0.0.1:5000",
  tasks: process.env.BACKEND_TASKS_URL ?? process.env.BACKEND_URL ?? "http://127.0.0.1:5000",
  projects: process.env.BACKEND_PROJECTS_URL ?? process.env.BACKEND_URL ?? "http://127.0.0.1:5000",
  analytics: process.env.BACKEND_ANALYTICS_URL ?? process.env.BACKEND_URL ?? "http://127.0.0.1:5000",
} as const;


export type BackendName = keyof typeof BACKENDS;
