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
    Title,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend, Title);

/* ── Types ─────────────────────────────────────────────────────────── */
type TimelineItem = {
    month_key: string;
    label: string;
    created: number;
    completed: number;
    overdue: number;
};

type PriorityItem = { priority: string; count: number };

type TasksOverTimeData = {
    timeline: TimelineItem[];
    summary: { todo: number; in_progress: number; done: number; total: number };
    by_priority: PriorityItem[];
    months: number;
};

/* ── Component ─────────────────────────────────────────────────────── */
export default function TasksOverTimeClient() {
    const [data, setData] = useState<TasksOverTimeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [months, setMonths] = useState(12);

    const fetchData = useCallback(async (m: number) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/analytics/tasks-over-time?months=${m}`);
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

    useEffect(() => { fetchData(months); }, [fetchData, months]);

    if (loading) {
        return (
            <div className="tot-loading">
                <div className="tot-loading-spinner" />
                <p>Đang tải dữ liệu thống kê…</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="tot-error">
                <span className="tot-error-icon">⚠️</span>
                <p>{error || "Không có dữ liệu."}</p>
                <button className="tot-retry-btn" onClick={() => fetchData(months)} type="button">Thử lại</button>
            </div>
        );
    }

    const { timeline, summary, by_priority } = data;
    const labels = timeline.map((t) => t.label);

    /* ── Bar Chart: Created vs Completed vs Overdue ──────────────────── */
    const barData = {
        labels,
        datasets: [
            {
                label: "Đã tạo",
                data: timeline.map((t) => t.created),
                backgroundColor: "rgba(79,142,247,0.75)",
                borderRadius: 5,
                barPercentage: 0.7,
                categoryPercentage: 0.6,
            },
            {
                label: "Hoàn thành",
                data: timeline.map((t) => t.completed),
                backgroundColor: "rgba(34,197,94,0.75)",
                borderRadius: 5,
                barPercentage: 0.7,
                categoryPercentage: 0.6,
            },
            {
                label: "Quá hạn",
                data: timeline.map((t) => t.overdue),
                backgroundColor: "rgba(239,68,68,0.75)",
                borderRadius: 5,
                barPercentage: 0.7,
                categoryPercentage: 0.6,
            },
        ],
    };

    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "top" as const,
                labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 12, family: "'Be Vietnam Pro', sans-serif" } },
            },
            tooltip: {
                callbacks: {
                    title: (items: { label: string }[]) => items[0]?.label || "",
                },
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, family: "'Be Vietnam Pro', sans-serif" } } },
            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { stepSize: 1, font: { size: 11 } } },
        },
    };

    /* ── Line Chart: Trend ───────────────────────────────────────────── */
    const lineData = {
        labels,
        datasets: [
            {
                label: "Đã tạo",
                data: timeline.map((t) => t.created),
                borderColor: "#4f8ef7",
                backgroundColor: "rgba(79,142,247,0.08)",
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 7,
                pointBackgroundColor: "#4f8ef7",
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
            },
            {
                label: "Hoàn thành",
                data: timeline.map((t) => t.completed),
                borderColor: "#22c55e",
                backgroundColor: "rgba(34,197,94,0.08)",
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 7,
                pointBackgroundColor: "#22c55e",
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
            },
            {
                label: "Quá hạn",
                data: timeline.map((t) => t.overdue),
                borderColor: "#ef4444",
                backgroundColor: "rgba(239,68,68,0.06)",
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 7,
                pointBackgroundColor: "#ef4444",
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
                borderDash: [5, 3],
            },
        ],
    };

    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "top" as const,
                labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 12, family: "'Be Vietnam Pro', sans-serif" } },
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, family: "'Be Vietnam Pro', sans-serif" } } },
            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { stepSize: 1, font: { size: 11 } } },
        },
    };

    /* ── Doughnut: Status Summary ────────────────────────────────────── */
    const doughnutData = {
        labels: ["Cần làm", "Đang làm", "Hoàn thành"],
        datasets: [{
            data: [summary.todo, summary.in_progress, summary.done],
            backgroundColor: ["#64748b", "#3b82f6", "#22c55e"],
            borderWidth: 2,
            borderColor: "#fff",
            cutout: "72%",
            hoverOffset: 6,
        }],
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom" as const,
                labels: { usePointStyle: true, pointStyleWidth: 10, padding: 14, font: { size: 11, family: "'Be Vietnam Pro', sans-serif" } },
            },
        },
    };

    /* ── Priority Bar Chart ──────────────────────────────────────────── */
    const priorityColors: Record<string, string> = {
        "Cao": "rgba(239,68,68,0.8)",
        "Trung bình": "rgba(249,115,22,0.8)",
        "Thấp": "rgba(100,116,139,0.7)",
        "Không xác định": "rgba(203,213,225,0.7)",
    };

    const priorityBarData = {
        labels: by_priority.map((p) => p.priority),
        datasets: [{
            label: "Số lượng",
            data: by_priority.map((p) => p.count),
            backgroundColor: by_priority.map((p) => priorityColors[p.priority] || "rgba(148,163,184,0.7)"),
            borderRadius: 6,
            barPercentage: 0.55,
        }],
    };

    const priorityBarOptions = {
        indexAxis: "y" as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { stepSize: 1, font: { size: 11 } } },
            y: { grid: { display: false }, ticks: { font: { size: 12, family: "'Be Vietnam Pro', sans-serif", weight: 600 as const } } },
        },
    };

    /* ── Cumulative Line Chart ───────────────────────────────────────── */
    const cumCreated: number[] = [];
    const cumCompleted: number[] = [];
    timeline.forEach((t, i) => {
        cumCreated.push((cumCreated[i - 1] || 0) + t.created);
        cumCompleted.push((cumCompleted[i - 1] || 0) + t.completed);
    });

    const cumulativeData = {
        labels,
        datasets: [
            {
                label: "Tổng tạo (tích lũy)",
                data: cumCreated,
                borderColor: "#6366f1",
                backgroundColor: "rgba(99,102,241,0.06)",
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#6366f1",
                borderWidth: 2.5,
            },
            {
                label: "Tổng hoàn thành (tích lũy)",
                data: cumCompleted,
                borderColor: "#22c55e",
                backgroundColor: "rgba(34,197,94,0.06)",
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#22c55e",
                borderWidth: 2.5,
            },
        ],
    };

    const cumulativeOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "top" as const,
                labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 12, family: "'Be Vietnam Pro', sans-serif" } },
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, family: "'Be Vietnam Pro', sans-serif" } } },
            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 11 } } },
        },
    };

    const totalCreated = timeline.reduce((a, t) => a + t.created, 0);
    const totalCompleted = timeline.reduce((a, t) => a + t.completed, 0);
    const totalOverdue = timeline.reduce((a, t) => a + t.overdue, 0);

    return (
        <div className="tot-container">
            {/* ── Period Filter ────────────────────────────────────────── */}
            <div className="tot-toolbar">
                <div className="tot-filter-group">
                    <span className="tot-filter-label">Khoảng thời gian:</span>
                    {[3, 6, 12].map((m) => (
                        <button
                            key={m}
                            className={`tot-filter-btn ${months === m ? "tot-filter-active" : ""}`}
                            onClick={() => setMonths(m)}
                            type="button"
                        >
                            {m} tháng
                        </button>
                    ))}
                </div>
                <button className="tot-refresh-btn" onClick={() => fetchData(months)} type="button" title="Làm mới">
                    🔄 Làm mới
                </button>
            </div>

            {/* ── Summary Cards ────────────────────────────────────────── */}
            <div className="tot-summary-row">
                <div className="tot-stat-card tot-stat-total">
                    <span className="tot-stat-icon">📋</span>
                    <div className="tot-stat-info">
                        <span className="tot-stat-label">Tổng công việc</span>
                        <span className="tot-stat-value">{summary.total}</span>
                    </div>
                </div>
                <div className="tot-stat-card tot-stat-created">
                    <span className="tot-stat-icon">📝</span>
                    <div className="tot-stat-info">
                        <span className="tot-stat-label">Đã tạo ({months}T)</span>
                        <span className="tot-stat-value">{totalCreated}</span>
                    </div>
                </div>
                <div className="tot-stat-card tot-stat-completed">
                    <span className="tot-stat-icon">✅</span>
                    <div className="tot-stat-info">
                        <span className="tot-stat-label">Hoàn thành ({months}T)</span>
                        <span className="tot-stat-value">{totalCompleted}</span>
                    </div>
                </div>
                <div className="tot-stat-card tot-stat-overdue">
                    <span className="tot-stat-icon">⚠️</span>
                    <div className="tot-stat-info">
                        <span className="tot-stat-label">Quá hạn ({months}T)</span>
                        <span className="tot-stat-value">{totalOverdue}</span>
                    </div>
                </div>
            </div>

            {/* ── Main Bar Chart ───────────────────────────────────────── */}
            <div className="tot-chart-card tot-chart-full">
                <h3 className="tot-chart-title">📊 Số lượng công việc theo thời gian</h3>
                <p className="tot-chart-desc">So sánh số lượng công việc: tạo mới, hoàn thành và quá hạn theo tháng</p>
                <div className="tot-chart-wrap tot-chart-tall">
                    <Bar data={barData} options={barOptions} />
                </div>
            </div>

            {/* ── Row 2: Line Trend + Status Doughnut ──────────────────── */}
            <div className="tot-charts-row">
                <div className="tot-chart-card tot-chart-wide">
                    <h3 className="tot-chart-title">📈 Xu hướng theo thời gian</h3>
                    <p className="tot-chart-desc">Biểu đồ đường thể hiện xu hướng tạo mới, hoàn thành và quá hạn</p>
                    <div className="tot-chart-wrap">
                        <Line data={lineData} options={lineOptions} />
                    </div>
                </div>
                <div className="tot-chart-card tot-chart-narrow">
                    <h3 className="tot-chart-title">🎯 Trạng thái hiện tại</h3>
                    <p className="tot-chart-desc">Phân bổ theo trạng thái</p>
                    <div className="tot-chart-wrap tot-chart-doughnut-wrap">
                        <Doughnut data={doughnutData} options={doughnutOptions} />
                        <div className="tot-doughnut-center">
                            <span className="tot-doughnut-num">{summary.total}</span>
                            <span className="tot-doughnut-label">tổng</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Row 3: Cumulative + Priority ──────────────────────────── */}
            <div className="tot-charts-row">
                <div className="tot-chart-card tot-chart-wide">
                    <h3 className="tot-chart-title">📉 Tích lũy theo thời gian</h3>
                    <p className="tot-chart-desc">Tổng số công việc tạo vs hoàn thành tích lũy — khoảng cách thể hiện backlog</p>
                    <div className="tot-chart-wrap">
                        <Line data={cumulativeData} options={cumulativeOptions} />
                    </div>
                </div>
                <div className="tot-chart-card tot-chart-narrow">
                    <h3 className="tot-chart-title">🏷️ Phân bổ theo ưu tiên</h3>
                    <p className="tot-chart-desc">Số lượng công việc theo mức ưu tiên</p>
                    <div className="tot-chart-wrap">
                        {by_priority.length > 0 ? (
                            <Bar data={priorityBarData} options={priorityBarOptions} />
                        ) : (
                            <div className="tot-no-data">Chưa có dữ liệu</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
