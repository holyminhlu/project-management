"use client";

import { useState } from "react";

type DeletedTask = {
  ma_cong_viec: string;
  tieu_de: string;
  ten_du_an: string | null;
  deleted_at: string | null;
  ten_nguoi_xoa: string | null;
};

type Props = {
  initialTasks: DeletedTask[];
};

function formatDateTime(value: string | null) {
  if (!value) return "Không rõ";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export default function TrashTasksClient({ initialTasks }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function restoreTask(taskId: string, statusKey: "todo" | "in_progress") {
    setBusyId(taskId);
    setError("");
    try {
      const response = await fetch(`/api/tasks/personal/${encodeURIComponent(taskId)}/restore`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_key: statusKey }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Không thể khôi phục công việc.");
        return;
      }
      setTasks((prev) => prev.filter((t) => t.ma_cong_viec !== taskId));
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setBusyId(null);
    }
  }

  async function deletePermanently(taskId: string) {
    const confirmed = window.confirm("Bạn chắc chắn muốn xóa vĩnh viễn công việc này khỏi CSDL?");
    if (!confirmed) return;
    setBusyId(taskId);
    setError("");
    try {
      const response = await fetch(`/api/tasks/personal/${encodeURIComponent(taskId)}/permanent`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Không thể xóa vĩnh viễn.");
        return;
      }
      setTasks((prev) => prev.filter((t) => t.ma_cong_viec !== taskId));
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="pm-trash-panel">
      <header className="pm-profile-panel-header">
        <h2 className="pm-profile-title">Công việc đã xóa</h2>
        <p className="pm-profile-subtitle">Khôi phục về Cần thực hiện/Đang thực hiện hoặc xóa vĩnh viễn.</p>
      </header>

      {error ? <p className="pm-profile-error">{error}</p> : null}

      <div className="pm-trash-list">
        {tasks.length === 0 ? (
          <div className="pm-project-empty">Không có công việc nào trong thùng rác.</div>
        ) : (
          tasks.map((task) => (
            <article key={task.ma_cong_viec} className="pm-trash-card">
              <div className="pm-trash-card-head">
                <h3>{task.tieu_de}</h3>
                <span>{task.ma_cong_viec}</span>
              </div>
              <p>Dự án: {task.ten_du_an || "Không rõ"}</p>
              <p>Người xóa: {task.ten_nguoi_xoa || "Không rõ"}</p>
              <p>Thời gian xóa: {formatDateTime(task.deleted_at)}</p>

              <div className="pm-trash-actions">
                <select
                  disabled={busyId === task.ma_cong_viec}
                  defaultValue=""
                  onChange={(e) => {
                    const action = e.target.value;
                    e.target.value = "";

                    if (action === "restore_todo") {
                      void restoreTask(task.ma_cong_viec, "todo");
                      return;
                    }

                    if (action === "restore_in_progress") {
                      void restoreTask(task.ma_cong_viec, "in_progress");
                      return;
                    }

                    if (action === "delete_permanent") {
                      void deletePermanently(task.ma_cong_viec);
                    }
                  }}
                >
                  <option value="" disabled>
                    Tùy chọn
                  </option>
                  <option value="restore_todo">Chuyển sang Cần thực hiện</option>
                  <option value="restore_in_progress">Chuyển sang Đang thực hiện</option>
                  <option value="delete_permanent">Xóa vĩnh viễn</option>
                </select>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
