"use client";

import { useEffect, useState, useCallback } from "react";

/* ── Types ─────────────────────────────────────────────────────────── */
type Assignee = { ma_nhan_vien: string; ten_nv: string };

type EisenhowerTask = {
    ma_cong_viec: string;
    tieu_de: string;
    mo_ta: string | null;
    trang_thai_cong_viec: string | null;
    do_uu_tien: string | null;
    ngay_tao: string | null;
    han_hoan_thanh: string | null;
    ma_du_an: string | null;
    ten_du_an: string | null;
    status_key: string;
    assignees: Assignee[];
    is_urgent: boolean;
    is_important: boolean;
    is_overdue: boolean;
    days_until_deadline: number | null;
};

type QuadrantKey = "do_first" | "schedule" | "delegate" | "eliminate";

type EisenhowerData = {
    quadrants: Record<QuadrantKey, EisenhowerTask[]>;
    summary: {
        total: number;
        do_first: number;
        schedule: number;
        delegate: number;
        eliminate: number;
    };
};

/* ── Quadrant Config ───────────────────────────────────────────────── */
const QUADRANT_CONFIG: Record<
    QuadrantKey,
    {
        title: string;
        subtitle: string;
        action: string;
        icon: string;
        className: string;
        headerClass: string;
        emptyText: string;
    }
> = {
    do_first: {
        title: "LÀM NGAY",
        subtitle: "Khẩn cấp & Quan trọng",
        action: "Do",
        icon: "🔥",
        className: "em-q-do",
        headerClass: "em-qh-do",
        emptyText: "Không có công việc khẩn cấp & quan trọng",
    },
    schedule: {
        title: "LÊN KẾ HOẠCH",
        subtitle: "Không khẩn cấp & Quan trọng",
        action: "Schedule",
        icon: "📅",
        className: "em-q-schedule",
        headerClass: "em-qh-schedule",
        emptyText: "Không có công việc cần lên kế hoạch",
    },
    delegate: {
        title: "ỦY QUYỀN",
        subtitle: "Khẩn cấp & Không quan trọng",
        action: "Delegate",
        icon: "🤝",
        className: "em-q-delegate",
        headerClass: "em-qh-delegate",
        emptyText: "Không có công việc cần ủy quyền",
    },
    eliminate: {
        title: "LOẠI BỎ",
        subtitle: "Không khẩn cấp & Không quan trọng",
        action: "Eliminate",
        icon: "🗑️",
        className: "em-q-eliminate",
        headerClass: "em-qh-eliminate",
        emptyText: "Không có công việc cần loại bỏ",
    },
};

/* ── Helpers ───────────────────────────────────────────────────────── */
function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function deadlineBadge(task: EisenhowerTask) {
    if (!task.han_hoan_thanh) return <span className="em-dl em-dl-none">Chưa có hạn</span>;
    if (task.is_overdue) {
        return <span className="em-dl em-dl-overdue">Quá hạn {Math.abs(task.days_until_deadline ?? 0)} ngày</span>;
    }
    if (task.days_until_deadline !== null && task.days_until_deadline <= 3) {
        return <span className="em-dl em-dl-soon">Còn {task.days_until_deadline} ngày</span>;
    }
    return <span className="em-dl em-dl-ok">{formatDate(task.han_hoan_thanh)}</span>;
}

function priorityBadge(priority: string | null) {
    const p = (priority || "").toLowerCase();
    if (p === "cao") return <span className="em-pri em-pri-high">Cao</span>;
    if (p === "trung bình") return <span className="em-pri em-pri-med">TB</span>;
    return <span className="em-pri em-pri-low">{priority || "Thấp"}</span>;
}

function toInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/* ── Component ─────────────────────────────────────────────────────── */
export default function EisenhowerMatrixClient() {
    const [data, setData] = useState<EisenhowerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedTask, setExpandedTask] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/analytics/eisenhower");
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || "Không thể tải dữ liệu.");
            }
            const json = await res.json();
            setData(json);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Lỗi không xác định.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) {
        return (
            <div className="em-loading">
                <div className="em-loading-spinner" />
                <p>Đang phân loại công việc…</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="em-error">
                <span className="em-error-icon">⚠️</span>
                <p>{error || "Không có dữ liệu."}</p>
                <button className="em-retry-btn" onClick={fetchData} type="button">Thử lại</button>
            </div>
        );
    }

    const { quadrants, summary } = data;
    const quadrantOrder: QuadrantKey[] = ["do_first", "schedule", "delegate", "eliminate"];

    return (
        <div className="em-container">
            {/* ── Summary Bar ──────────────────────────────────────────── */}
            <div className="em-summary-bar">
                <div className="em-summary-total">
                    <span className="em-summary-total-num">{summary.total}</span>
                    <span className="em-summary-total-label">công việc</span>
                </div>
                {quadrantOrder.map((key) => {
                    const cfg = QUADRANT_CONFIG[key];
                    return (
                        <div key={key} className={`em-summary-chip ${cfg.className}`}>
                            <span className="em-summary-chip-icon">{cfg.icon}</span>
                            <span className="em-summary-chip-num">{summary[key]}</span>
                            <span className="em-summary-chip-label">{cfg.action}</span>
                        </div>
                    );
                })}
                <button className="em-refresh-btn" onClick={fetchData} type="button" title="Làm mới">
                    🔄
                </button>
            </div>

            {/* ── Axis Labels ──────────────────────────────────────────── */}
            <div className="em-matrix-wrapper">
                <div className="em-axis-y">
                    <div className="em-axis-y-label">
                        <span className="em-axis-arrow">▲</span>
                        <span>QUAN TRỌNG</span>
                    </div>
                </div>

                <div className="em-matrix-body">
                    {/* Column headers */}
                    <div className="em-col-headers">
                        <div className="em-col-header em-col-header-urgent">⚡ KHẨN CẤP</div>
                        <div className="em-col-header em-col-header-not-urgent">🕐 KHÔNG KHẨN CẤP</div>
                    </div>

                    {/* Matrix Grid */}
                    <div className="em-matrix-grid">
                        {/* Row 1: Important */}
                        <QuadrantCard
                            quadrantKey="do_first"
                            tasks={quadrants.do_first}
                            expandedTask={expandedTask}
                            onToggle={setExpandedTask}
                        />
                        <QuadrantCard
                            quadrantKey="schedule"
                            tasks={quadrants.schedule}
                            expandedTask={expandedTask}
                            onToggle={setExpandedTask}
                        />

                        {/* Row 2: Not Important */}
                        <QuadrantCard
                            quadrantKey="delegate"
                            tasks={quadrants.delegate}
                            expandedTask={expandedTask}
                            onToggle={setExpandedTask}
                        />
                        <QuadrantCard
                            quadrantKey="eliminate"
                            tasks={quadrants.eliminate}
                            expandedTask={expandedTask}
                            onToggle={setExpandedTask}
                        />
                    </div>

                    {/* X-axis label */}
                    <div className="em-axis-x">
                        <span>KHẨN CẤP</span>
                        <span className="em-axis-arrow-x">▸</span>
                    </div>
                </div>
            </div>

            {/* ── Legend ────────────────────────────────────────────────── */}
            <div className="em-legend">
                <div className="em-legend-title">📖 Cách phân loại:</div>
                <div className="em-legend-items">
                    <div className="em-legend-item">
                        <span className="em-legend-dot em-legend-dot-urgent" />
                        <span><strong>Khẩn cấp:</strong> deadline ≤ 3 ngày hoặc quá hạn</span>
                    </div>
                    <div className="em-legend-item">
                        <span className="em-legend-dot em-legend-dot-important" />
                        <span><strong>Quan trọng:</strong> độ ưu tiên &quot;Cao&quot;</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── QuadrantCard ───────────────────────────────────────────────────── */
function QuadrantCard({
    quadrantKey,
    tasks,
    expandedTask,
    onToggle,
}: {
    quadrantKey: QuadrantKey;
    tasks: EisenhowerTask[];
    expandedTask: string | null;
    onToggle: (id: string | null) => void;
}) {
    const cfg = QUADRANT_CONFIG[quadrantKey];

    return (
        <div className={`em-quadrant ${cfg.className}`}>
            <div className={`em-quadrant-header ${cfg.headerClass}`}>
                <div className="em-qh-left">
                    <span className="em-qh-icon">{cfg.icon}</span>
                    <div>
                        <span className="em-qh-title">{cfg.title}</span>
                        <span className="em-qh-subtitle">{cfg.subtitle}</span>
                    </div>
                </div>
                <span className="em-qh-count">{tasks.length}</span>
            </div>

            <div className="em-quadrant-body">
                {tasks.length === 0 ? (
                    <div className="em-empty">
                        <span className="em-empty-icon">✨</span>
                        <span>{cfg.emptyText}</span>
                    </div>
                ) : (
                    <ul className="em-task-list">
                        {tasks.map((task) => {
                            const isExpanded = expandedTask === task.ma_cong_viec;
                            return (
                                <li key={task.ma_cong_viec} className={`em-task-item ${isExpanded ? "em-task-expanded" : ""}`}>
                                    <button
                                        className="em-task-btn"
                                        onClick={() => onToggle(isExpanded ? null : task.ma_cong_viec)}
                                        type="button"
                                    >
                                        <div className="em-task-top">
                                            <span className="em-task-name">{task.tieu_de}</span>
                                            {priorityBadge(task.do_uu_tien)}
                                        </div>
                                        <div className="em-task-meta">
                                            {deadlineBadge(task)}
                                            {task.ten_du_an && <span className="em-task-project">{task.ten_du_an}</span>}
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="em-task-detail">
                                            {task.mo_ta && (
                                                <div className="em-detail-row">
                                                    <span className="em-detail-label">Mô tả</span>
                                                    <span className="em-detail-value">{task.mo_ta}</span>
                                                </div>
                                            )}
                                            <div className="em-detail-row">
                                                <span className="em-detail-label">Trạng thái</span>
                                                <span className="em-detail-value">{task.trang_thai_cong_viec || "—"}</span>
                                            </div>
                                            <div className="em-detail-row">
                                                <span className="em-detail-label">Ngày tạo</span>
                                                <span className="em-detail-value">{formatDate(task.ngay_tao)}</span>
                                            </div>
                                            <div className="em-detail-row">
                                                <span className="em-detail-label">Hạn hoàn thành</span>
                                                <span className="em-detail-value">{formatDate(task.han_hoan_thanh)}</span>
                                            </div>
                                            {task.assignees.length > 0 && (
                                                <div className="em-detail-row">
                                                    <span className="em-detail-label">Người làm</span>
                                                    <div className="em-detail-assignees">
                                                        {task.assignees.map((a) => (
                                                            <span key={a.ma_nhan_vien} className="em-assignee-chip" title={a.ten_nv}>
                                                                <span className="em-assignee-avatar">{toInitials(a.ten_nv)}</span>
                                                                {a.ten_nv}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
