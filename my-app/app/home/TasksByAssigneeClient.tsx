"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Filler,
    Tooltip,
    Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend);

/* ── Types ─────────────────────────────────────────────────────────── */
type PriorityItem = { priority: string; count: number };

type Assignee = {
    id: string;
    name: string;
    total: number;
    completed: number;
    in_progress: number;
    todo: number;
    overdue: number;
    completion_rate: number;
    by_priority: PriorityItem[];
};

type Summary = {
    total_members: number;
    total_tasks: number;
    total_completed: number;
    total_overdue: number;
    avg_tasks_per_member: number;
    avg_completion_rate: number;
};

type AssigneeData = {
    assignees: Assignee[];
    summary: Summary;
};

/* ── Helpers ───────────────────────────────────────────────────────── */
function getInitials(name: string) {
    return name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(-2)
        .toUpperCase();
}

const AVATAR_COLORS = [
    "#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6",
    "#ef4444", "#10b981", "#8b5cf6", "#f97316", "#06b6d4",
];

/* ── Component ─────────────────────────────────────────────────────── */
export default function TasksByAssigneeClient() {
    const [data, setData] = useState<AssigneeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/analytics/tasks-by-assignee");
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || "Không thể tải dữ liệu.");
            }
            setData(await res.json());
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Lỗi không xác định.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <div className="tot-loading">
                <div className="tot-loading-spinner" />
                <p>Đang tải dữ liệu…</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="tot-error">
                <span className="tot-error-icon">⚠️</span>
                <p>{error || "Không có dữ liệu."}</p>
                <button className="tot-retry-btn" onClick={fetchData} type="button">Thử lại</button>
            </div>
        );
    }

    const { assignees, summary } = data;

    /* ── Stacked Bar: Status per Assignee ────────────────────────────── */
    const names = assignees.map((a) => a.name.split(" ").slice(-2).join(" "));

    const stackedBarData = {
        labels: names,
        datasets: [
            {
                label: "Hoàn thành",
                data: assignees.map((a) => a.completed),
                backgroundColor: "rgba(34,197,94,0.8)",
                borderRadius: 4,
            },
            {
                label: "Đang làm",
                data: assignees.map((a) => a.in_progress),
                backgroundColor: "rgba(59,130,246,0.8)",
                borderRadius: 4,
            },
            {
                label: "Cần làm",
                data: assignees.map((a) => a.todo),
                backgroundColor: "rgba(148,163,184,0.7)",
                borderRadius: 4,
            },
            {
                label: "Quá hạn",
                data: assignees.map((a) => a.overdue),
                backgroundColor: "rgba(239,68,68,0.8)",
                borderRadius: 4,
            },
        ],
    };

    const stackedBarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "top" as const,
                labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 12, family: "'Be Vietnam Pro', sans-serif" } },
            },
        },
        scales: {
            x: { stacked: true, grid: { display: false }, ticks: { font: { size: 12, family: "'Be Vietnam Pro', sans-serif" } } },
            y: { stacked: true, beginAtZero: true, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { stepSize: 1, font: { size: 11 } } },
        },
    };

    /* ── Workload Doughnut ───────────────────────────────────────────── */
    const doughnutData = {
        labels: assignees.map((a) => a.name),
        datasets: [{
            data: assignees.map((a) => a.total),
            backgroundColor: assignees.map((_, i) => AVATAR_COLORS[i % AVATAR_COLORS.length]),
            borderWidth: 2,
            borderColor: "#fff",
            cutout: "68%",
            hoverOffset: 8,
        }],
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom" as const,
                labels: { usePointStyle: true, pointStyleWidth: 10, padding: 12, font: { size: 11, family: "'Be Vietnam Pro', sans-serif" } },
            },
        },
    };

    /* ── Completion Rate Bar ─────────────────────────────────────────── */
    const completionBarData = {
        labels: names,
        datasets: [{
            label: "Tỷ lệ hoàn thành (%)",
            data: assignees.map((a) => a.completion_rate),
            backgroundColor: assignees.map((a) =>
                a.completion_rate >= 80 ? "rgba(34,197,94,0.8)"
                    : a.completion_rate >= 50 ? "rgba(249,115,22,0.8)"
                        : "rgba(239,68,68,0.8)"
            ),
            borderRadius: 6,
            barPercentage: 0.55,
        }],
    };

    const completionBarOptions = {
        indexAxis: "y" as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { beginAtZero: true, max: 100, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { callback: (v: number | string) => `${v}%`, font: { size: 11 } } },
            y: { grid: { display: false }, ticks: { font: { size: 12, family: "'Be Vietnam Pro', sans-serif", weight: 600 as const } } },
        },
    };

    return (
        <div className="tba-container">
            {/* ── Summary Cards ──────────────────────────────────────────── */}
            <div className="tot-summary-row">
                <div className="tot-stat-card" style={{ borderLeftColor: "#6366f1" }}>
                    <span className="tot-stat-icon">👥</span>
                    <div className="tot-stat-info">
                        <span className="tot-stat-label">Thành viên</span>
                        <span className="tot-stat-value">{summary.total_members}</span>
                    </div>
                </div>
                <div className="tot-stat-card" style={{ borderLeftColor: "#3b82f6" }}>
                    <span className="tot-stat-icon">📋</span>
                    <div className="tot-stat-info">
                        <span className="tot-stat-label">Tổng CV</span>
                        <span className="tot-stat-value">{summary.total_tasks}</span>
                    </div>
                </div>
                <div className="tot-stat-card" style={{ borderLeftColor: "#22c55e" }}>
                    <span className="tot-stat-icon">📊</span>
                    <div className="tot-stat-info">
                        <span className="tot-stat-label">TB/Người</span>
                        <span className="tot-stat-value">{summary.avg_tasks_per_member}</span>
                    </div>
                </div>
                <div className="tot-stat-card" style={{ borderLeftColor: "#f59e0b" }}>
                    <span className="tot-stat-icon">🎯</span>
                    <div className="tot-stat-info">
                        <span className="tot-stat-label">TB hoàn thành</span>
                        <span className="tot-stat-value">{summary.avg_completion_rate}%</span>
                    </div>
                </div>
            </div>

            {/* ── Row 1: Stacked Status Chart ────────────────────────────── */}
            <div className="tot-chart-card">
                <h3 className="tot-chart-title">📊 Phân bổ trạng thái theo người thực hiện</h3>
                <p className="tot-chart-desc">Biểu đồ cột xếp chồng thể hiện phân bổ trạng thái công việc cho từng thành viên</p>
                <div className="tot-chart-wrap tot-chart-tall">
                    <Bar data={stackedBarData} options={stackedBarOptions} />
                </div>
            </div>

            {/* ── Row 2: Workload Doughnut + Completion Rate ─────────────── */}
            <div className="tot-charts-row">
                <div className="tot-chart-card tot-chart-narrow">
                    <h3 className="tot-chart-title">🍩 Phân bổ khối lượng</h3>
                    <p className="tot-chart-desc">Tỷ lệ công việc của từng thành viên</p>
                    <div className="tot-chart-wrap tot-chart-doughnut-wrap">
                        <Doughnut data={doughnutData} options={doughnutOptions} />
                        <div className="tot-doughnut-center">
                            <span className="tot-doughnut-num">{summary.total_tasks}</span>
                            <span className="tot-doughnut-label">tổng CV</span>
                        </div>
                    </div>
                </div>
                <div className="tot-chart-card tot-chart-wide">
                    <h3 className="tot-chart-title">✅ Tỷ lệ hoàn thành</h3>
                    <p className="tot-chart-desc">Tỷ lệ hoàn thành của từng thành viên</p>
                    <div className="tot-chart-wrap" style={{ height: Math.max(160, assignees.length * 48) }}>
                        <Bar data={completionBarData} options={completionBarOptions} />
                    </div>
                </div>
            </div>

            {/* ── Detail Table ────────────────────────────────────────────── */}
            <div className="tba-table-card">
                <h3 className="tot-chart-title">📋 Chi tiết theo từng thành viên</h3>
                <p className="tot-chart-desc">Bảng tổng hợp chi tiết công việc của mỗi người</p>
                <div className="tba-table-wrap">
                    <table className="tba-table">
                        <thead>
                            <tr>
                                <th>Thành viên</th>
                                <th>Tổng</th>
                                <th>Hoàn thành</th>
                                <th>Đang làm</th>
                                <th>Cần làm</th>
                                <th>Quá hạn</th>
                                <th>Tỷ lệ</th>
                                <th>Ưu tiên</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assignees.map((a, i) => (
                                <tr key={a.id}>
                                    <td>
                                        <div className="tba-member">
                                            <span className="tba-rank">#{i + 1}</span>
                                            <span
                                                className="tba-avatar"
                                                style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                                            >
                                                {getInitials(a.name)}
                                            </span>
                                            <div className="tba-member-info">
                                                <span className="tba-name">{a.name}</span>
                                                <span className="tba-member-id">{a.id}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td><strong>{a.total}</strong></td>
                                    <td><span className="tba-badge tba-badge-done">{a.completed}</span></td>
                                    <td><span className="tba-badge tba-badge-progress">{a.in_progress}</span></td>
                                    <td><span className="tba-badge tba-badge-todo">{a.todo}</span></td>
                                    <td><span className={`tba-badge ${a.overdue > 0 ? "tba-badge-overdue" : "tba-badge-ok"}`}>{a.overdue}</span></td>
                                    <td>
                                        <div className="tba-rate-cell">
                                            <div className="tba-rate-bar">
                                                <div
                                                    className="tba-rate-fill"
                                                    style={{
                                                        width: `${a.completion_rate}%`,
                                                        background: a.completion_rate >= 80 ? "#22c55e" : a.completion_rate >= 50 ? "#f59e0b" : "#ef4444",
                                                    }}
                                                />
                                            </div>
                                            <span className="tba-rate-text">{a.completion_rate}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="tba-priority-chips">
                                            {a.by_priority.map((p) => (
                                                <span
                                                    key={p.priority}
                                                    className={`tba-priority-chip tba-priority-${p.priority === "Cao" ? "high" : p.priority === "Trung bình" ? "med" : "low"}`}
                                                >
                                                    {p.priority}: {p.count}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
