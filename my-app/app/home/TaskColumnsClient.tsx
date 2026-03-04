"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

type TaskStatusKey = "todo" | "in_progress" | "done";

type PersonalTask = {
  ma_cong_viec: string;
  tieu_de: string;
  trang_thai_cong_viec: string | null;
  do_uu_tien: string | null;
  ngay_tao: string | null;
  han_hoan_thanh: string | null;
  ma_nhan_vien_phu_trach: string | null;
  ten_nguoi_phu_trach: string | null;
  ma_du_an: string | null;
  ten_du_an: string | null;
  status_key: TaskStatusKey;
};

type Props = {
  selectedProjectId: string;
  selectedProjectName: string;
  initialTasks: PersonalTask[];
  isSortEnabled: boolean;
};

type CreateFormState = {
  tieu_de: string;
  mo_ta: string;
  do_uu_tien: string;
  han_hoan_thanh: string;
};

const DEFAULT_FORM: CreateFormState = {
  tieu_de: "",
  mo_ta: "",
  do_uu_tien: "Trung bình",
  han_hoan_thanh: "",
};

function parseSqlDateTime(dateValue: string | null) {
  if (!dateValue) return null;
  const raw = String(dateValue).trim();
  if (!raw) return null;

  let date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date;

  // SQL Server often returns "YYYY-MM-DD HH:mm:ss(.sss)".
  const normalized = raw.replace(" ", "T");
  date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return date;

  return null;
}

function formatDueDate(dateValue: string | null) {
  if (!dateValue) return "Chưa có hạn";
  const date = parseSqlDateTime(dateValue);
  if (!date) return String(dateValue);
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatCreatedAt(dateValue: string | null) {
  if (!dateValue) return "Không rõ";
  const date = parseSqlDateTime(dateValue);
  if (!date) return String(dateValue);
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function statusToLabel(status: TaskStatusKey) {
  if (status === "done") return "Đã hoàn thành";
  if (status === "in_progress") return "Đang thực hiện";
  return "Cần thực hiện";
}

function toInitials(name: string | null | undefined) {
  const clean = String(name || "").trim();
  if (!clean) return "NA";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0]?.[0] || "";
  const last = parts[parts.length - 1]?.[0] || "";
  return `${first}${last}`.toUpperCase();
}

function getDeadlineState(task: PersonalTask): "normal" | "due_soon" | "overdue" {
  if (!(task.status_key === "todo" || task.status_key === "in_progress")) return "normal";
  if (!task.han_hoan_thanh) return "normal";

  const dueDate = parseSqlDateTime(task.han_hoan_thanh);
  if (!dueDate) return "normal";
  const due = dueDate.getTime();

  const now = Date.now();
  const diffMs = due - now;
  if (diffMs < 0) return "overdue";
  if (diffMs <= 24 * 60 * 60 * 1000) return "due_soon";
  return "normal";
}

export default function TaskColumnsClient({ selectedProjectId, selectedProjectName, initialTasks, isSortEnabled }: Props) {
  const [tasks, setTasks] = useState<PersonalTask[]>(
    initialTasks.map((task) => ({
      ...task,
      ngay_tao: task.ngay_tao || new Date().toISOString(),
    })),
  );
  const [openStatus, setOpenStatus] = useState<TaskStatusKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<TaskStatusKey | null>(null);
  const [assigneeTaskId, setAssigneeTaskId] = useState<string | null>(null);
  const [assigneeCode, setAssigneeCode] = useState("");
  const [addingAssignee, setAddingAssignee] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM);
  const [error, setError] = useState("");

  const sortedTasks = useMemo(() => {
    return tasks.slice().sort((a, b) => {
      if (!isSortEnabled) return 0;
      const aTime = a.han_hoan_thanh ? new Date(a.han_hoan_thanh).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.han_hoan_thanh ? new Date(b.han_hoan_thanh).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }, [tasks, isSortEnabled]);

  const todoTasks = sortedTasks.filter((task) => task.status_key === "todo");
  const inProgressTasks = sortedTasks.filter((task) => task.status_key === "in_progress");
  const doneTasks = sortedTasks.filter((task) => task.status_key === "done");

  async function createTask(status: TaskStatusKey) {
    const tieu_de = form.tieu_de.trim();
    if (!tieu_de) {
      setError("Vui lòng nhập tiêu đề công việc.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        ma_du_an: selectedProjectId,
        tieu_de,
        mo_ta: form.mo_ta.trim(),
        do_uu_tien: form.do_uu_tien,
        han_hoan_thanh: form.han_hoan_thanh || null,
        status_key: status,
      };

      const response = await fetch("/api/tasks/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as {
        task?: PersonalTask;
        error?: string;
      };

      if (!response.ok || !data.task) {
        setError(data.error || "Không thể tạo công việc.");
        return;
      }

      const createdTask = data.task as PersonalTask;
      if (!createdTask.ngay_tao) {
        createdTask.ngay_tao = new Date().toISOString();
      }
      setTasks((prev) => [createdTask, ...prev]);
      setOpenStatus(null);
      setForm(DEFAULT_FORM);
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  }

  async function moveTask(taskId: string, nextStatus: TaskStatusKey) {
    const currentTask = tasks.find((item) => item.ma_cong_viec === taskId);
    if (!currentTask) return;
    const previousStatus = currentTask.status_key;
    if (previousStatus === nextStatus) return;

    setMoving(true);
    setError("");

    setTasks((prev) =>
      prev.map((task) =>
        task.ma_cong_viec === taskId
          ? {
              ...task,
              status_key: nextStatus,
              trang_thai_cong_viec: statusToLabel(nextStatus),
            }
          : task,
      ),
    );

    try {
      const response = await fetch(`/api/tasks/personal/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_key: nextStatus }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setTasks((prev) =>
          prev.map((task) =>
            task.ma_cong_viec === taskId
              ? {
                  ...task,
                  status_key: previousStatus,
                  trang_thai_cong_viec: statusToLabel(previousStatus),
                }
              : task,
          ),
        );
        setError(data.error || "Không thể cập nhật trạng thái công việc.");
      }
    } catch {
      setTasks((prev) =>
        prev.map((task) =>
          task.ma_cong_viec === taskId
            ? {
                ...task,
                status_key: previousStatus,
                trang_thai_cong_viec: statusToLabel(previousStatus),
              }
            : task,
        ),
      );
      setError("Không thể kết nối máy chủ.");
    } finally {
      setMoving(false);
    }
  }

  function openForm(status: TaskStatusKey) {
    setError("");
    setOpenStatus(status);
    setForm(DEFAULT_FORM);
  }

  function closeForm() {
    setOpenStatus(null);
    setForm(DEFAULT_FORM);
    setError("");
  }

  function onDragStart(taskId: string) {
    setDraggingTaskId(taskId);
    setError("");
  }

  async function addAssignee(taskId: string) {
    const ma_nhan_vien = assigneeCode.trim().toUpperCase();
    if (!ma_nhan_vien) {
      setError("Vui lòng nhập mã nhân viên.");
      return;
    }

    setAddingAssignee(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/personal/${encodeURIComponent(taskId)}/assignees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ma_nhan_vien }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        assignee?: { ma_nhan_vien?: string; ten_nv?: string };
        error?: string;
      };

      if (!response.ok) {
        setError(data.error || "Không thể thêm người làm cho công việc.");
        return;
      }

      if (data.assignee?.ten_nv) {
        setTasks((prev) =>
          prev.map((task) =>
            task.ma_cong_viec === taskId
              ? {
                  ...task,
                  ma_nhan_vien_phu_trach: data.assignee?.ma_nhan_vien || task.ma_nhan_vien_phu_trach,
                  ten_nguoi_phu_trach: data.assignee?.ten_nv || task.ten_nguoi_phu_trach,
                }
              : task,
          ),
        );
      }

      setAssigneeTaskId(null);
      setAssigneeCode("");
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setAddingAssignee(false);
    }
  }

  async function onDropColumn(status: TaskStatusKey) {
    const taskId = draggingTaskId;
    setDropStatus(null);
    setDraggingTaskId(null);
    if (!taskId) return;
    await moveTask(taskId, status);
  }

  async function deleteTask(taskId: string) {
    const confirmed = window.confirm("Bạn có chắc muốn xóa công việc này vào thùng rác?");
    if (!confirmed) return;

    setDeletingTaskId(taskId);
    setError("");
    try {
      const response = await fetch(`/api/tasks/personal/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_key: "deleted" }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Không thể xóa công việc.");
        return;
      }
      setTasks((prev) => prev.filter((task) => task.ma_cong_viec !== taskId));
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setDeletingTaskId(null);
    }
  }

  function renderForm(status: TaskStatusKey) {
    if (openStatus !== status) return null;
    return (
      <div className="pm-task-create-form">
        <input
          className="pm-task-form-input"
          placeholder="Tiêu đề công việc"
          value={form.tieu_de}
          onChange={(e) => setForm((prev) => ({ ...prev, tieu_de: e.target.value }))}
        />
        <textarea
          className="pm-task-form-textarea"
          placeholder="Mô tả"
          value={form.mo_ta}
          onChange={(e) => setForm((prev) => ({ ...prev, mo_ta: e.target.value }))}
        />
        <div className="pm-task-form-row">
          <select
            className="pm-task-form-select"
            value={form.do_uu_tien}
            onChange={(e) => setForm((prev) => ({ ...prev, do_uu_tien: e.target.value }))}
          >
            <option value="Thấp">Thấp</option>
            <option value="Trung bình">Trung bình</option>
            <option value="Cao">Cao</option>
          </select>
          <input
            className="pm-task-form-input"
            type="date"
            value={form.han_hoan_thanh}
            onChange={(e) => setForm((prev) => ({ ...prev, han_hoan_thanh: e.target.value }))}
          />
        </div>
        <div className="pm-task-form-actions">
          <button className="pm-task-form-cancel" type="button" onClick={closeForm}>
            Hủy
          </button>
          <button className="pm-task-form-save" type="button" onClick={() => void createTask(status)} disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    );
  }

  function renderColumn(status: TaskStatusKey, title: string, columnTasks: PersonalTask[]) {
    const isDropTarget = dropStatus === status;
    return (
      <section
        className={`pm-task-column${isDropTarget ? " pm-task-column-drop" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (dropStatus !== status) setDropStatus(status);
        }}
        onDragLeave={() => {
          if (dropStatus === status) setDropStatus(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          void onDropColumn(status);
        }}
      >
        <header className="pm-task-col-header">
          <h3>{title}</h3>
          <span>{columnTasks.length}</span>
        </header>

        <div className="pm-task-list">
          {columnTasks.length === 0 ? (
            <p className="pm-task-empty">Chưa có công việc.</p>
          ) : (
            columnTasks.map((task) => (
              <article
                key={task.ma_cong_viec}
                className={`pm-task-card${draggingTaskId === task.ma_cong_viec ? " pm-task-card-dragging" : ""}${
                  task.status_key === "done"
                    ? " pm-task-card-done"
                    : getDeadlineState(task) === "overdue"
                      ? " pm-task-card-overdue"
                      : getDeadlineState(task) === "due_soon"
                        ? " pm-task-card-due-soon"
                        : ""
                }`}
                draggable
                onDragStart={() => onDragStart(task.ma_cong_viec)}
                onDragEnd={() => {
                  setDraggingTaskId(null);
                  setDropStatus(null);
                }}
              >
                <button
                  className="pm-task-assignee-plus"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setError("");
                    setAssigneeTaskId((prev) => (prev === task.ma_cong_viec ? null : task.ma_cong_viec));
                    setAssigneeCode("");
                  }}
                  title="Thêm người làm"
                >
                  +
                </button>
                <button
                  className="pm-task-delete-btn"
                  type="button"
                  title="Xóa công việc"
                  disabled={deletingTaskId === task.ma_cong_viec}
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteTask(task.ma_cong_viec);
                  }}
                >
                  <Image src="/icon/bin.png" alt="Delete" width={14} height={14} />
                </button>
                <h4>{task.tieu_de}</h4>
                <p>Mã: {task.ma_cong_viec}</p>
                <p>Dự án: {task.ten_du_an || selectedProjectName}</p>
                <p>Tạo lúc: {formatCreatedAt(task.ngay_tao)}</p>
                <p>Hạn: {formatDueDate(task.han_hoan_thanh)}</p>
                <div className="pm-task-assignee">
                  <span className="pm-task-assignee-avatar">{toInitials(task.ten_nguoi_phu_trach)}</span>
                  <span className="pm-task-assignee-name">{task.ten_nguoi_phu_trach || "Người phụ trách"}</span>
                </div>
                {assigneeTaskId === task.ma_cong_viec ? (
                  <div className="pm-task-assignee-form">
                    <input
                      className="pm-task-assignee-input"
                      placeholder="Mã NV, ví dụ: NV02"
                      value={assigneeCode}
                      onChange={(e) => setAssigneeCode(e.target.value)}
                    />
                    <div className="pm-task-assignee-actions">
                      <button
                        className="pm-task-assignee-cancel"
                        type="button"
                        onClick={() => {
                          setAssigneeTaskId(null);
                          setAssigneeCode("");
                        }}
                      >
                        Hủy
                      </button>
                      <button
                        className="pm-task-assignee-save"
                        type="button"
                        disabled={addingAssignee}
                        onClick={() => void addAssignee(task.ma_cong_viec)}
                      >
                        {addingAssignee ? "Đang thêm..." : "Thêm"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>

        <div className="pm-task-add-row">
          <button className="pm-task-plus-btn" type="button" onClick={() => openForm(status)}>
            +
          </button>
        </div>
        {renderForm(status)}
      </section>
    );
  }

  return (
    <>
      {error ? <p className="pm-profile-error">{error}</p> : null}
      {moving ? <p className="pm-task-moving-note">Đang cập nhật trạng thái công việc...</p> : null}

      <div className="pm-task-board">
        {renderColumn("todo", "Cần thực hiện", todoTasks)}
        {renderColumn("in_progress", "Đang thực hiện", inProgressTasks)}
        {renderColumn("done", "Đã hoàn thành", doneTasks)}

        <section className="pm-task-column pm-task-column-add">
          <button className="pm-task-add-btn" type="button">
            + Thêm nhóm công việc
          </button>
        </section>
      </div>
    </>
  );
}

