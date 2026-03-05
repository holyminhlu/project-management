"use client";

import { Fragment, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { clientApi } from "@/lib/api/client";

type TaskStatusKey = "todo" | "in_progress" | "done";

type TaskAssignee = {
  ma_nhan_vien: string;
  ten_nv: string;
};

type PersonalTask = {
  ma_cong_viec: string;
  tieu_de: string;
  trang_thai_cong_viec: string | null;
  do_uu_tien: string | null;
  ngay_tao: string | null;
  han_hoan_thanh: string | null;
  ma_du_an: string | null;
  ten_du_an: string | null;
  status_key: TaskStatusKey;
  assignees?: TaskAssignee[];
};

type ProjectMemberItem = {
  ma_nhan_vien: string;
  ten_nv: string;
};

type Props = {
  selectedProjectId: string;
  selectedProjectName: string;
  initialTasks: PersonalTask[];
  isSortEnabled: boolean;
  projectMembers?: ProjectMemberItem[];
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

export default function TaskColumnsClient({ selectedProjectId, selectedProjectName, initialTasks, isSortEnabled, projectMembers = [] }: Props) {
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
  const [addingAssignee, setAddingAssignee] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  function exportToPDF() {
    const now = new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit", minute: "2-digit",
      day: "2-digit", month: "2-digit", year: "numeric",
    }).format(new Date());

    const allTasks = tasks;
    const todoList = allTasks.filter((t) => t.status_key === "todo");
    const inProgressList = allTasks.filter((t) => t.status_key === "in_progress");
    const doneList = allTasks.filter((t) => t.status_key === "done");

    function taskRows(taskList: PersonalTask[]) {
      if (taskList.length === 0) {
        return `<tr><td colspan="5" style="text-align:center;color:#888;padding:12px;">Chưa có công việc</td></tr>`;
      }
      return taskList
        .map(
          (t, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${t.tieu_de}</td>
            <td>${formatDueDate(t.han_hoan_thanh)}</td>
            <td>${t.do_uu_tien || "—"}</td>
            <td>${(t.assignees || []).map((a) => a.ten_nv).join(", ") || "—"}</td>
          </tr>`,
        )
        .join("");
    }

    const memberRows =
      projectMembers.length === 0
        ? `<tr><td colspan="2" style="text-align:center;color:#888;padding:12px;">Chưa có thành viên</td></tr>`
        : projectMembers
            .map(
              (m, i) =>
                `<tr><td>${i + 1}</td><td>${m.ten_nv}</td><td>${m.ma_nhan_vien}</td></tr>`,
            )
            .join("");

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Báo cáo dự án - ${selectedProjectName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #1a1f2e; padding: 32px; font-size: 13px; line-height: 1.5; }
    .report-header { border-bottom: 2px solid #4f8ef7; padding-bottom: 16px; margin-bottom: 24px; }
    .report-header h1 { font-size: 22px; font-weight: 700; color: #1a1f2e; margin-bottom: 4px; }
    .report-meta { color: #666; font-size: 12px; }
    .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 28px; }
    .stat-box { border: 1px solid #e5e8f0; border-radius: 8px; padding: 12px; text-align: center; background: #f9fafb; }
    .stat-box .num { font-size: 22px; font-weight: 800; color: #1a1f2e; }
    .stat-box .lbl { font-size: 11px; color: #666; margin-top: 2px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 14px; font-weight: 700; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; }
    .section-title.members { background: #eef2ff; color: #3730a3; border-left: 4px solid #4f46e5; }
    .section-title.todo    { background: #f5f7fa; color: #475569; border-left: 4px solid #94a3b8; }
    .section-title.inprogress { background: #eef2ff; color: #3730a3; border-left: 4px solid #4f46e5; }
    .section-title.done   { background: #ecfdf5; color: #065f46; border-left: 4px solid #059669; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f4f6fb; padding: 8px 10px; text-align: left; font-size: 12px; border: 1px solid #dde3ef; font-weight: 700; }
    td { padding: 7px 10px; border: 1px solid #e5e8f0; font-size: 12px; vertical-align: top; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    .footer { margin-top: 32px; border-top: 1px solid #e5e8f0; padding-top: 12px; font-size: 11px; color: #999; text-align: right; }
    @media print {
      body { padding: 16px; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>Báo cáo dự án: ${selectedProjectName}</h1>
    <div class="report-meta">Mã dự án: ${selectedProjectId} &nbsp;|&nbsp; Ngày xuất: ${now}</div>
  </div>

  <div class="stats-grid">
    <div class="stat-box"><div class="num">${allTasks.length}</div><div class="lbl">Tổng công việc</div></div>
    <div class="stat-box"><div class="num">${todoList.length}</div><div class="lbl">Cần thực hiện</div></div>
    <div class="stat-box"><div class="num">${inProgressList.length}</div><div class="lbl">Đang thực hiện</div></div>
    <div class="stat-box"><div class="num">${doneList.length}</div><div class="lbl">Đã hoàn thành</div></div>
    <div class="stat-box"><div class="num">${projectMembers.length}</div><div class="lbl">Thành viên</div></div>
  </div>

  <div class="section">
    <div class="section-title members">Thành viên dự án (${projectMembers.length})</div>
    <table>
      <thead><tr><th>#</th><th>Tên nhân viên</th><th>Mã nhân viên</th></tr></thead>
      <tbody>${memberRows}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title todo">Cần thực hiện (${todoList.length})</div>
    <table>
      <thead><tr><th>#</th><th>Tiêu đề công việc</th><th>Hạn hoàn thành</th><th>Độ ưu tiên</th><th>Người phụ trách</th></tr></thead>
      <tbody>${taskRows(todoList)}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title inprogress">Đang thực hiện (${inProgressList.length})</div>
    <table>
      <thead><tr><th>#</th><th>Tiêu đề công việc</th><th>Hạn hoàn thành</th><th>Độ ưu tiên</th><th>Người phụ trách</th></tr></thead>
      <tbody>${taskRows(inProgressList)}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title done">Đã hoàn thành (${doneList.length})</div>
    <table>
      <thead><tr><th>#</th><th>Tiêu đề công việc</th><th>Hạn hoàn thành</th><th>Độ ưu tiên</th><th>Người phụ trách</th></tr></thead>
      <tbody>${taskRows(doneList)}</tbody>
    </table>
  </div>

  <div class="footer">Được tạo bởi hệ thống quản lý dự án &mdash; ${now}</div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=960,height=720");
    if (!win) {
      alert("Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép pop-up để xuất PDF.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.print();
    };
  }

  const filteredTasks = useMemo(() => {
    let result = tasks.slice();

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => t.tieu_de.toLowerCase().includes(q));
    }

    // Sort logic
    result.sort((a, b) => {
      if (!isSortEnabled) return 0;
      const aTime = a.han_hoan_thanh ? new Date(a.han_hoan_thanh).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.han_hoan_thanh ? new Date(b.han_hoan_thanh).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    return result;
  }, [tasks, searchQuery, isSortEnabled]);

  const todoTasks = filteredTasks.filter((task) => task.status_key === "todo" && (statusFilter === "all" || statusFilter === "todo"));
  const inProgressTasks = filteredTasks.filter((task) => task.status_key === "in_progress" && (statusFilter === "all" || statusFilter === "in_progress"));
  const doneTasks = filteredTasks.filter((task) => task.status_key === "done" && (statusFilter === "all" || statusFilter === "done"));

  async function createTask(status: TaskStatusKey) {
    const tieu_de = form.tieu_de.trim();
    if (!tieu_de) {
      setError("Vui lòng nhập tiêu đề công việc.");
      return;
    }

    setSubmitting(true);
    setError("");
    const payload = {
      ma_du_an: selectedProjectId,
      tieu_de,
      mo_ta: form.mo_ta.trim(),
      do_uu_tien: form.do_uu_tien,
      han_hoan_thanh: form.han_hoan_thanh || null,
      status_key: status,
    };
    const { data, ok, error } = await clientApi<{ task?: PersonalTask; error?: string }>(
      "/api/tasks/personal",
      { method: "POST", body: payload },
    );
    setSubmitting(false);
    if (!ok || !data?.task) {
      setError(error ?? "Không thể tạo công việc.");
      return;
    }
    const createdTask = data.task as PersonalTask;
    if (!createdTask.ngay_tao) {
      createdTask.ngay_tao = new Date().toISOString();
    }
    setTasks((prev) => [createdTask, ...prev]);
    setOpenStatus(null);
    setForm(DEFAULT_FORM);
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
          ? { ...task, status_key: nextStatus, trang_thai_cong_viec: statusToLabel(nextStatus) }
          : task,
      ),
    );

    const { ok, error } = await clientApi<{ error?: string }>(
      `/api/tasks/personal/${encodeURIComponent(taskId)}`,
      { method: "PATCH", body: { status_key: nextStatus } },
    );
    setMoving(false);
    if (!ok) {
      setTasks((prev) =>
        prev.map((task) =>
          task.ma_cong_viec === taskId
            ? { ...task, status_key: previousStatus, trang_thai_cong_viec: statusToLabel(previousStatus) }
            : task,
        ),
      );
      setError(error ?? "Không thể cập nhật trạng thái công việc.");
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

  // Nhiệm vụ 1: Thêm người làm chung (append) thay vì thay thế
  async function addAssignee(taskId: string, memberId: string) {
    if (!memberId) {
      setError("Vui lòng chọn thành viên.");
      return;
    }

    // Check if already assigned
    const currentTask = tasks.find((t) => t.ma_cong_viec === taskId);
    const currentAssignees = currentTask?.assignees || [];
    if (currentAssignees.some((a) => a.ma_nhan_vien === memberId)) {
      setError("Thành viên này đã được thêm vào công việc.");
      return;
    }

    setAddingAssignee(true);
    setError("");
    const { data, ok, error } = await clientApi<{
      assignee?: { ma_nhan_vien?: string; ten_nv?: string };
      error?: string;
    }>(
      `/api/tasks/personal/${encodeURIComponent(taskId)}/assignees`,
      { method: "POST", body: { ma_nhan_vien: memberId } },
    );
    setAddingAssignee(false);
    if (!ok) {
      setError(error ?? "Không thể thêm người làm cho công việc.");
      return;
    }
    if (data?.assignee?.ma_nhan_vien && data.assignee?.ten_nv) {
      const newAssignee: TaskAssignee = {
        ma_nhan_vien: data.assignee.ma_nhan_vien,
        ten_nv: data.assignee.ten_nv,
      };
      setTasks((prev) =>
        prev.map((task) =>
          task.ma_cong_viec === taskId
            ? { ...task, assignees: [...(task.assignees || []), newAssignee] }
            : task,
        ),
      );
    }
    setAssigneeTaskId(null);
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
    const { ok, error } = await clientApi<{ error?: string }>(
      `/api/tasks/personal/${encodeURIComponent(taskId)}`,
      { method: "PATCH", body: { status_key: "deleted" } },
    );
    setDeletingTaskId(null);
    if (!ok) {
      setError(error ?? "Không thể xóa công việc.");
      return;
    }
    setTasks((prev) => prev.filter((task) => task.ma_cong_viec !== taskId));
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

  // Nhiệm vụ 2: Thiết kế lại phần chọn thành viên
  function renderAssigneePanel(task: PersonalTask) {
    if (assigneeTaskId !== task.ma_cong_viec) return null;
    const currentAssignees = task.assignees || [];
    const currentAssigneeIds = new Set(currentAssignees.map((a) => a.ma_nhan_vien));
    const availableMembers = projectMembers.filter((m) => !currentAssigneeIds.has(m.ma_nhan_vien));

    return (
      <div className="pm-assignee-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pm-assignee-panel-head">
          <span className="pm-assignee-panel-head-title">Thêm người làm chung</span>
          <button
            className="pm-assignee-panel-head-close"
            type="button"
            onClick={() => setAssigneeTaskId(null)}
          >
            ✕
          </button>
        </div>

        {currentAssignees.length > 0 && (
          <div className="pm-assignee-section">
            <div className="pm-assignee-section-title">Đang phụ trách ({currentAssignees.length})</div>
            <div className="pm-assignee-current-chips">
              {currentAssignees.map((a, idx) => {
                const colors = ["#4f8ef7", "#20b486", "#f08a4b", "#8b78f7", "#ef5f8f"];
                return (
                  <div key={a.ma_nhan_vien} className="pm-assignee-chip-item">
                    <span className="pm-assignee-chip-dot" style={{ backgroundColor: colors[idx % colors.length] }}>
                      {toInitials(a.ten_nv)}
                    </span>
                    <span className="pm-assignee-chip-text">{a.ten_nv}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="pm-assignee-section">
          <div className="pm-assignee-section-title">
            {availableMembers.length > 0
              ? `Chọn thành viên để thêm (${availableMembers.length})`
              : "Tất cả thành viên đã được thêm"}
          </div>
          {availableMembers.length > 0 && (
            <div className="pm-assignee-member-list">
              {availableMembers.map((member) => {
                return (
                  <button
                    key={member.ma_nhan_vien}
                    className="pm-assignee-member-row"
                    type="button"
                    disabled={addingAssignee}
                    onClick={() => void addAssignee(task.ma_cong_viec, member.ma_nhan_vien)}
                  >
                    <span className="pm-assignee-member-dot" style={{ backgroundColor: "#4f8ef7" }}>
                      {toInitials(member.ten_nv)}
                    </span>
                    <span className="pm-assignee-member-detail">
                      <span className="pm-assignee-member-detail-name">{member.ten_nv}</span>
                      <span className="pm-assignee-member-detail-code">{member.ma_nhan_vien}</span>
                    </span>
                    <span className="pm-assignee-member-add-icon">
                      {addingAssignee ? "…" : "+"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
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
            columnTasks.map((task) => {
              const assignees = task.assignees || [];
              return (
                <article
                  key={task.ma_cong_viec}
                  className={`pm-task-card${draggingTaskId === task.ma_cong_viec ? " pm-task-card-dragging" : ""}${task.status_key === "done"
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
                    }}
                    title="Thêm người làm chung"
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

                  {/* Hiển thị tất cả người phụ trách */}
                  <div className="pm-task-assignees-row">
                    {assignees.length === 0 ? (
                      <span className="pm-task-assignee-none">Chưa có người phụ trách</span>
                    ) : (
                      <>
                        <div className="pm-task-assignee-avatar-group">
                          {assignees.slice(0, 4).map((a, idx) => {
                            const colors = ["#4f8ef7", "#20b486", "#f08a4b", "#8b78f7", "#ef5f8f"];
                            return (
                              <span
                                key={a.ma_nhan_vien}
                                className="pm-task-avatar"
                                style={{ backgroundColor: colors[idx % colors.length], zIndex: 10 - idx }}
                                title={a.ten_nv}
                              >
                                {toInitials(a.ten_nv)}
                              </span>
                            );
                          })}
                          {assignees.length > 4 && (
                            <span className="pm-task-avatar pm-task-avatar-extra">
                              +{assignees.length - 4}
                            </span>
                          )}
                        </div>
                        <span className="pm-task-assignee-label">
                          {assignees.map((a) => a.ten_nv).join(", ")}
                        </span>
                      </>
                    )}
                  </div>

                  {renderAssigneePanel(task)}
                </article>
              );
            })
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

  function renderListView() {
    const groups: Array<{ key: TaskStatusKey; label: string; tasks: PersonalTask[] }> = [
      { key: "todo", label: "Cần thực hiện", tasks: todoTasks },
      { key: "in_progress", label: "Đang thực hiện", tasks: inProgressTasks },
      { key: "done", label: "Đã hoàn thành", tasks: doneTasks },
    ];

    return (
      <div className="pm-task-list-view">
        {groups.map(({ key, label, tasks: groupTasks }) => {
          if (statusFilter !== "all" && statusFilter !== key) return null;
          return (
            <div key={key} className="pm-list-group">
              <div className={`pm-list-group-header pm-list-group-header-${key}`}>
                <span className="pm-list-group-title">{label}</span>
                <span className="pm-list-group-count">{groupTasks.length}</span>
              </div>
              {groupTasks.length === 0 ? (
                <div className="pm-list-group-empty">Chưa có công việc.</div>
              ) : (
                <table className="pm-task-list-table">
                  <thead>
                    <tr>
                      <th>Tiêu đề công việc</th>
                      <th>Hạn hoàn thành</th>
                      <th>Ưu tiên</th>
                      <th>Người phụ trách</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupTasks.map((task) => {
                      const assignees = task.assignees || [];
                      const deadlineState = getDeadlineState(task);
                      const isDetail = detailTaskId === task.ma_cong_viec;
                      const isAssignee = assigneeTaskId === task.ma_cong_viec;
                      const colors = ["#4f8ef7", "#20b486", "#f08a4b", "#8b78f7", "#ef5f8f"];

                      return (
                        <Fragment key={task.ma_cong_viec}>
                          <tr className={`pm-list-row${isDetail || isAssignee ? " pm-list-row-active" : ""}`}>
                            <td className="td-title">{task.tieu_de}</td>
                            <td
                              className={`td-due${
                                deadlineState === "overdue"
                                  ? " td-overdue"
                                  : deadlineState === "due_soon"
                                    ? " td-due-soon"
                                    : ""
                              }`}
                            >
                              {formatDueDate(task.han_hoan_thanh)}
                            </td>
                            <td>
                              <span
                                className={`pm-list-priority pm-list-priority-${
                                  (task.do_uu_tien || "").toLowerCase().replace(/\s+/g, "-")
                                }`}
                              >
                                {task.do_uu_tien || "—"}
                              </span>
                            </td>
                            <td className="td-assignees">
                              <div className="pm-task-assignees-row" style={{ marginTop: 0 }}>
                                {assignees.length === 0 ? (
                                  <span className="pm-task-assignee-none">—</span>
                                ) : (
                                  <>
                                    {assignees.slice(0, 4).map((a, idx) => (
                                      <span
                                        key={a.ma_nhan_vien}
                                        className="pm-task-assignee-dot"
                                        style={{ backgroundColor: colors[idx % colors.length] }}
                                        title={a.ten_nv}
                                      >
                                        {toInitials(a.ten_nv)}
                                      </span>
                                    ))}
                                    {assignees.length > 4 && (
                                      <span className="pm-task-assignee-dot pm-task-avatar-extra">
                                        +{assignees.length - 4}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="td-actions">
                              <div className="pm-list-actions">
                                <button
                                  className={`pm-list-action-btn pm-list-action-info${isDetail ? " active" : ""}`}
                                  type="button"
                                  title="Thông tin công việc"
                                  onClick={() => {
                                    setDetailTaskId((prev) =>
                                      prev === task.ma_cong_viec ? null : task.ma_cong_viec,
                                    );
                                    setAssigneeTaskId(null);
                                  }}
                                >
                                  <Image src="/icon/more.png" alt="Info" width={14} height={14} />
                                  <span>Thông tin</span>
                                </button>
                                <button
                                  className={`pm-list-action-btn pm-list-action-assign${isAssignee ? " active" : ""}`}
                                  type="button"
                                  title="Thêm thành viên"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setError("");
                                    setAssigneeTaskId((prev) =>
                                      prev === task.ma_cong_viec ? null : task.ma_cong_viec,
                                    );
                                    setDetailTaskId(null);
                                  }}
                                >
                                  <Image src="/icon/addfriends.png" alt="Thêm thành viên" width={14} height={14} />
                                  <span>Thành viên</span>
                                </button>
                                <div className="pm-list-actions-divider" />
                                <button
                                  className="pm-list-delete-btn"
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
                              </div>
                            </td>
                          </tr>

                          {isDetail && (
                            <tr className="pm-list-detail-row">
                              <td colSpan={5}>
                                <div className="pm-list-detail-panel">
                                  <div className="pm-list-detail-card">
                                    <div className="pm-list-detail-item">
                                      <span className="pm-list-detail-label">Mã công việc</span>
                                      <span className="pm-list-detail-value">{task.ma_cong_viec}</span>
                                    </div>
                                    <div className="pm-list-detail-item">
                                      <span className="pm-list-detail-label">Dự án</span>
                                      <span className="pm-list-detail-value">{task.ten_du_an || selectedProjectName}</span>
                                    </div>
                                    <div className="pm-list-detail-item">
                                      <span className="pm-list-detail-label">Ngày tạo</span>
                                      <span className="pm-list-detail-value">{formatCreatedAt(task.ngay_tao)}</span>
                                    </div>
                                    <div className="pm-list-detail-item">
                                      <span className="pm-list-detail-label">Trạng thái</span>
                                      <span className={`status-badge status-badge-${task.status_key}`}>
                                        {statusToLabel(task.status_key)}
                                      </span>
                                    </div>
                                    <div className="pm-list-detail-item">
                                      <span className="pm-list-detail-label">Độ ưu tiên</span>
                                      <span className="pm-list-detail-value">{task.do_uu_tien || "Chưa đặt"}</span>
                                    </div>
                                    {assignees.length > 0 && (
                                      <div className="pm-list-detail-item pm-list-detail-item-wide">
                                        <span className="pm-list-detail-label">Người phụ trách</span>
                                        <span className="pm-list-detail-value">
                                          {assignees.map((a) => a.ten_nv).join(", ")}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}

                          {isAssignee && (
                            <tr className="pm-list-assignee-row">
                              <td colSpan={5}>{renderAssigneePanel(task)}</td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {error ? <p className="pm-profile-error">{error}</p> : null}
      {moving ? <p className="pm-task-moving-note">Đang cập nhật trạng thái công việc...</p> : null}

      <div className="pm-task-tools">
        <label className="pm-tool-search-wrap">
          <Image className="pm-tool-icon-image" src="/icon/search.png" alt="Search" width={14} height={14} />
          <input
            className="pm-tool-search"
            type="text"
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
        <button className="pm-tool-icon-btn" type="button" aria-label="Bộ lọc">
          <Image className="pm-tool-icon-image" src="/icon/filter.png" alt="Filter" width={14} height={14} />
        </button>
        <div className="pm-tool-select-wrap">
          <select
            className="pm-tool-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Bộ lọc trạng thái công việc</option>
            <option value="todo">Cần thực hiện</option>
            <option value="in_progress">Đang thực hiện</option>
            <option value="done">Đã hoàn thành</option>
          </select>
        </div>
        <button className="pm-tool-btn" type="button" onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}>
          <Image className="pm-tool-icon-image" src="/icon/nofilter.svg" alt="No Filter" width={14} height={14} />
          Không lọc
        </button>
        <Link
          className="pm-tool-btn"
          href={
            isSortEnabled
              ? `/home?view=personal-tasks&project=${encodeURIComponent(selectedProjectId)}`
              : `/home?view=personal-tasks&project=${encodeURIComponent(selectedProjectId)}&sort=due_asc`
          }
        >
          <Image className="pm-tool-icon-image" src="/icon/sort.svg" alt="Sort" width={14} height={14} />
          {isSortEnabled ? "Sắp xếp" : "Không sắp xếp"}
        </Link>
        <div className="pm-tool-select-wrap">
          <select
            className="pm-tool-select"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as "board" | "list")}
          >
            <option value="board">Hiển thị dạng cột</option>
            <option value="list">Hiển thị dạng danh sách</option>
          </select>
        </div>
        <button className="pm-tool-btn" type="button" onClick={exportToPDF}>
          <Image className="pm-tool-icon-image" src="/icon/export.png" alt="Export" width={14} height={14} />
          Xuất khẩu
        </button>
        <button className="pm-tool-btn" type="button">
          <Image className="pm-tool-icon-image" src="/icon/chart.png" alt="Analyze" width={14} height={14} />
          Phân tích công việc
        </button>
        <Link
          className="pm-tool-refresh"
          href={`/home?view=personal-tasks&project=${encodeURIComponent(selectedProjectId)}`}
        >
          <Image className="pm-tool-icon-image" src="/icon/refresh.png" alt="Refresh" width={14} height={14} />
          Làm mới
        </Link>
      </div>
      {viewMode === "board" ? (
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
      ) : (
        renderListView()
      )}
    </>
  );
}
