"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Filler,
    Title,
} from "chart.js";
import { Pie, Doughnut, Bar, Line } from "react-chartjs-2";

ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Filler,
    Title,
);

/* ── Types ─────────────────────────────────────────────────────────── */
type Summary = {
    total_tasks: number;
    todo: number;
    in_progress: number;
    done: number;
    overdue: number;
    unassigned: number;
    progress_percent: number;
};

type WorkloadItem = {
    name: string;
    ma_nhan_vien: string;
    task_count: number;
    done_count: number;
    overdue_count: number;
};

type ProjectProgress = {
    ma_du_an: string;
    ten_du_an: string;
    ngay_bat_dau: string | null;
    ngay_ket_thuc: string | null;
    total_tasks: number;
    done_tasks: number;
    in_progress_tasks: number;
    overdue_tasks: number;
    progress_percent: number;
};

type CompletionTrend = {
    week: string;
    year: number;
    week_start: string | null;
    completed: number;
};

type OverdueByProject = {
    project: string;
    count: number;
};

type CycleTime = {
    avg_days: number | null;
    min_days: number | null;
    max_days: number | null;
};

type DashboardData = {
    summary: Summary;
    status_distribution: Record<string, { label: string; count: number }>;
    workload: WorkloadItem[];
    projects: ProjectProgress[];
    completion_trend: CompletionTrend[];
    overdue_by_project: OverdueByProject[];
    cycle_time: CycleTime;
};

/* ── Component ─────────────────────────────────────────────────────── */
export default function AnalyticsDashboardClient() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/analytics/dashboard");
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || "Không thể tải dữ liệu phân tích.");
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
            <div className="ad-loading">
                <div className="ad-loading-spinner" />
                <p>Đang tải dữ liệu phân tích...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="ad-error">
                <span className="ad-error-icon">⚠️</span>
                <p>{error || "Không có dữ liệu."}</p>
                <button className="ad-retry-btn" onClick={fetchData} type="button">
                    Thử lại
                </button>
            </div>
        );
    }

    const { summary, workload, projects, completion_trend, overdue_by_project, cycle_time } = data;

    /* ── Chart colours ─────────────────────────────────────────────── */
    const STATUS_COLORS = {
        todo: "#64748b",
        in_progress: "#3b82f6",
        done: "#22c55e",
        other: "#a78bfa",
    };

    const GRADIENT_BAR = [
        "rgba(79,142,247,0.85)",
        "rgba(99,102,241,0.85)",
        "rgba(168,85,247,0.85)",
        "rgba(236,72,153,0.85)",
        "rgba(14,165,233,0.85)",
        "rgba(34,197,94,0.85)",
        "rgba(249,115,22,0.85)",
        "rgba(244,63,94,0.85)",
    ];

    /* ── Task Status Pie ───────────────────────────────────────────── */
    const statusLabels: string[] = [];
    const statusValues: number[] = [];
    const statusColors: string[] = [];
    for (const [key, val] of Object.entries(data.status_distribution)) {
        statusLabels.push(val.label);
        statusValues.push(val.count);
        statusColors.push(
            STATUS_COLORS[key as keyof typeof STATUS_COLORS] || STATUS_COLORS.other,
        );
    }

    const pieData = {
        labels: statusLabels,
        datasets: [
            {
                data: statusValues,
                backgroundColor: statusColors,
                borderWidth: 2,
                borderColor: "#ffffff",
                hoverOffset: 8,
            },
        ],
    };

    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom" as const,
                labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 12, family: "'Be Vietnam Pro', sans-serif" } },
            },
            tooltip: {
                callbacks: {
                    label: (ctx: { label: string; raw: unknown; dataset: { data: number[] } }) => {
                        const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
                        const pct = total > 0 ? ((Number(ctx.raw) / total) * 100).toFixed(1) : 0;
                        return `${ctx.label}: ${ctx.raw} (${pct}%)`;
                    },
                },
            },
        },
    };

    /* ── Progress Doughnut ─────────────────────────────────────────── */
    const doughnutData = {
        labels: ["Hoàn thành", "Còn lại"],
        datasets: [
            {
                data: [summary.done, summary.total_tasks - summary.done],
                backgroundColor: ["#22c55e", "#e2e8f0"],
                borderWidth: 0,
                cutout: "78%",
            },
        ],
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx: { label: string; raw: unknown }) => `${ctx.label}: ${ctx.raw} task`,
                },
            },
        },
    };

    /* ── Workload Bar ──────────────────────────────────────────────── */
    const workloadData = {
        labels: workload.map((w) => w.name),
        datasets: [
            {
                label: "Đã hoàn thành",
                data: workload.map((w) => w.done_count),
                backgroundColor: "rgba(34,197,94,0.8)",
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.65,
            },
            {
                label: "Đang xử lý",
                data: workload.map((w) => w.task_count - w.done_count - w.overdue_count),
                backgroundColor: "rgba(59,130,246,0.8)",
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.65,
            },
            {
                label: "Quá hạn",
                data: workload.map((w) => w.overdue_count),
                backgroundColor: "rgba(239,68,68,0.8)",
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.65,
            },
        ],
    };

    const workloadOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: "top" as const, labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 11, family: "'Be Vietnam Pro', sans-serif" } } },
        },
        scales: {
            x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11, family: "'Be Vietnam Pro', sans-serif" } } },
            y: { stacked: true, beginAtZero: true, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { stepSize: 1, font: { size: 11 } } },
        },
    };

    /* ── Completion Trend Line ─────────────────────────────────────── */
    const trendLabels = completion_trend.length > 0 ? completion_trend.map((t) => t.week) : ["W1", "W2", "W3", "W4"];
    const trendValues = completion_trend.length > 0 ? completion_trend.map((t) => t.completed) : [0, 0, 0, 0];

    const trendData = {
        labels: trendLabels,
        datasets: [
            {
                label: "Task hoàn thành",
                data: trendValues,
                borderColor: "#4f8ef7",
                backgroundColor: "rgba(79,142,247,0.1)",
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: "#4f8ef7",
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
            },
        ],
    };

    const trendOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, family: "'Be Vietnam Pro', sans-serif" } } },
            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { stepSize: 1, font: { size: 11 } } },
        },
    };

    /* ── Overdue By Project Bar ────────────────────────────────────── */
    const overdueBarData = {
        labels: overdue_by_project.length > 0 ? overdue_by_project.map((o) => o.project) : ["Không có dữ liệu"],
        datasets: [
            {
                label: "Task quá hạn",
                data: overdue_by_project.length > 0 ? overdue_by_project.map((o) => o.count) : [0],
                backgroundColor: overdue_by_project.map((_, i) => GRADIENT_BAR[i % GRADIENT_BAR.length]),
                borderRadius: 6,
                barPercentage: 0.6,
            },
        ],
    };

    const overdueBarOptions = {
        indexAxis: "y" as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
        scales: {
            x: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { stepSize: 1, font: { size: 11 } } },
            y: { grid: { display: false }, ticks: { font: { size: 11, family: "'Be Vietnam Pro', sans-serif" } } },
        },
    };

    /* ── Burndown (simulated from projects) ────────────────────────── */
    const burndownProject = projects.length > 0 ? projects[0] : null;
    let burndownData = null;

    if (burndownProject && burndownProject.ngay_bat_dau && burndownProject.ngay_ket_thuc) {
        const start = new Date(burndownProject.ngay_bat_dau);
        const end = new Date(burndownProject.ngay_ket_thuc);
        const now = new Date();
        const totalDays = Math.max(Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)), 1);
        const elapsedDays = Math.min(Math.max(Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)), 0), totalDays);
        const totalT = burndownProject.total_tasks;
        const doneT = burndownProject.done_tasks;
        const segments = Math.min(totalDays, 10);
        const segSize = totalDays / segments;

        const idealLine: number[] = [];
        const actualLine: number[] = [];
        const labels: string[] = [];

        for (let i = 0; i <= segments; i++) {
            const dayAt = Math.round(i * segSize);
            labels.push(`Ngày ${dayAt}`);
            idealLine.push(Math.max(totalT - Math.round((totalT / totalDays) * dayAt), 0));
            if (dayAt <= elapsedDays) {
                const progressAtDay = (dayAt / Math.max(elapsedDays, 1)) * doneT;
                actualLine.push(Math.max(totalT - Math.round(progressAtDay), 0));
            }
        }

        burndownData = {
            labels,
            datasets: [
                {
                    label: "Lý tưởng",
                    data: idealLine,
                    borderColor: "#94a3b8",
                    borderDash: [6, 4],
                    pointRadius: 3,
                    pointBackgroundColor: "#94a3b8",
                    tension: 0.1,
                    fill: false,
                },
                {
                    label: "Thực tế",
                    data: actualLine,
                    borderColor: "#ef4444",
                    backgroundColor: "rgba(239,68,68,0.08)",
                    pointRadius: 4,
                    pointBackgroundColor: "#ef4444",
                    pointBorderColor: "#fff",
                    pointBorderWidth: 2,
                    tension: 0.3,
                    fill: true,
                },
            ],
        };
    }

    const burndownOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: "top" as const, labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 11, family: "'Be Vietnam Pro', sans-serif" } } },
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { stepSize: 1, font: { size: 11 } } },
        },
    };

    /* ── Sprint Velocity Bar (from project data) ───────────────────── */
    const velocityData = {
        labels: projects.map((p) => p.ten_du_an),
        datasets: [
            {
                label: "Task hoàn thành",
                data: projects.map((p) => p.done_tasks),
                backgroundColor: projects.map((_, i) => GRADIENT_BAR[i % GRADIENT_BAR.length]),
                borderRadius: 6,
                barPercentage: 0.55,
            },
        ],
    };

    const velocityOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, family: "'Be Vietnam Pro', sans-serif" }, maxRotation: 30 } },
            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { stepSize: 1, font: { size: 11 } } },
        },
    };

    return (
        <div className="ad-container">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="ad-header">
                <div className="ad-header-text">
                    <h1 className="ad-title">📊 Phân tích công việc</h1>
                    <p className="ad-subtitle">Dashboard tổng quan phân tích dữ liệu dự án và công việc</p>
                </div>
                <button className="ad-refresh-btn" onClick={fetchData} type="button" title="Làm mới dữ liệu">
                    🔄 Làm mới
                </button>
            </div>

            {/* ── Row 1: Summary Cards ───────────────────────────────────── */}
            <div className="ad-summary-row">
                <div className="ad-stat-card ad-stat-progress">
                    <div className="ad-stat-icon">📈</div>
                    <div className="ad-stat-info">
                        <span className="ad-stat-label">Tiến độ chung</span>
                        <span className="ad-stat-value">{summary.progress_percent}%</span>
                    </div>
                    <div className="ad-progress-bar-mini">
                        <div className="ad-progress-fill-mini" style={{ width: `${summary.progress_percent}%` }} />
                    </div>
                </div>
                <div className="ad-stat-card ad-stat-total">
                    <div className="ad-stat-icon">📋</div>
                    <div className="ad-stat-info">
                        <span className="ad-stat-label">Tổng công việc</span>
                        <span className="ad-stat-value">{summary.total_tasks}</span>
                    </div>
                </div>
                <div className="ad-stat-card ad-stat-done">
                    <div className="ad-stat-icon">✅</div>
                    <div className="ad-stat-info">
                        <span className="ad-stat-label">Hoàn thành</span>
                        <span className="ad-stat-value">{summary.done}</span>
                    </div>
                </div>
                <div className="ad-stat-card ad-stat-overdue">
                    <div className="ad-stat-icon">⚠️</div>
                    <div className="ad-stat-info">
                        <span className="ad-stat-label">Quá hạn</span>
                        <span className="ad-stat-value">{summary.overdue}</span>
                    </div>
                </div>
            </div>

            {/* ── Row 2: Pie Chart + Workload ────────────────────────────── */}
            <div className="ad-charts-row">
                <div className="ad-chart-card ad-chart-small">
                    <h3 className="ad-chart-title">🎯 Trạng thái công việc</h3>
                    <p className="ad-chart-desc">Phân bổ công việc theo trạng thái</p>
                    <div className="ad-chart-wrap ad-chart-pie-wrap">
                        <Pie data={pieData} options={pieOptions} />
                    </div>
                </div>

                <div className="ad-chart-card ad-chart-progress-ring">
                    <h3 className="ad-chart-title">🏆 Tiến độ dự án</h3>
                    <p className="ad-chart-desc">Tỷ lệ hoàn thành tổng quan</p>
                    <div className="ad-chart-wrap ad-chart-doughnut-wrap">
                        <Doughnut data={doughnutData} options={doughnutOptions} />
                        <div className="ad-doughnut-center">
                            <span className="ad-doughnut-percent">{summary.progress_percent}%</span>
                            <span className="ad-doughnut-label">Hoàn thành</span>
                        </div>
                    </div>
                    <div className="ad-stat-mini-row">
                        <div className="ad-stat-mini">
                            <span className="ad-stat-mini-dot" style={{ background: "#64748b" }} />
                            <span>Cần làm: {summary.todo}</span>
                        </div>
                        <div className="ad-stat-mini">
                            <span className="ad-stat-mini-dot" style={{ background: "#3b82f6" }} />
                            <span>Đang làm: {summary.in_progress}</span>
                        </div>
                        <div className="ad-stat-mini">
                            <span className="ad-stat-mini-dot" style={{ background: "#22c55e" }} />
                            <span>Xong: {summary.done}</span>
                        </div>
                    </div>
                </div>

                <div className="ad-chart-card ad-chart-large">
                    <h3 className="ad-chart-title">👥 Phân bổ công việc</h3>
                    <p className="ad-chart-desc">Khối lượng công việc mỗi thành viên</p>
                    <div className="ad-chart-wrap">
                        {workload.length > 0 ? (
                            <Bar data={workloadData} options={workloadOptions} />
                        ) : (
                            <div className="ad-no-data">Chưa có dữ liệu</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Row 3: Burndown + Velocity ─────────────────────────────── */}
            <div className="ad-charts-row ad-charts-row-2">
                <div className="ad-chart-card ad-chart-half">
                    <h3 className="ad-chart-title">📉 Burndown Chart</h3>
                    <p className="ad-chart-desc">
                        Theo dõi tiến độ sprint
                        {burndownProject ? ` — ${burndownProject.ten_du_an}` : ""}
                    </p>
                    <div className="ad-chart-wrap">
                        {burndownData ? (
                            <Line data={burndownData} options={burndownOptions} />
                        ) : (
                            <div className="ad-no-data">Chưa có dữ liệu timeline để vẽ Burndown</div>
                        )}
                    </div>
                </div>

                <div className="ad-chart-card ad-chart-half">
                    <h3 className="ad-chart-title">🚀 Velocity dự án</h3>
                    <p className="ad-chart-desc">Số task hoàn thành theo từng dự án</p>
                    <div className="ad-chart-wrap">
                        {projects.length > 0 ? (
                            <Bar data={velocityData} options={velocityOptions} />
                        ) : (
                            <div className="ad-no-data">Chưa có dữ liệu</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Row 4: Trend + Cycle Time ──────────────────────────────── */}
            <div className="ad-charts-row ad-charts-row-2">
                <div className="ad-chart-card ad-chart-half">
                    <h3 className="ad-chart-title">📅 Xu hướng hoàn thành</h3>
                    <p className="ad-chart-desc">Số task hoàn thành theo tuần (8 tuần gần nhất)</p>
                    <div className="ad-chart-wrap">
                        <Line data={trendData} options={trendOptions} />
                    </div>
                </div>

                <div className="ad-chart-card ad-chart-half">
                    <h3 className="ad-chart-title">⏱️ Lead Time / Cycle Time</h3>
                    <p className="ad-chart-desc">Thời gian trung bình hoàn thành công việc</p>
                    <div className="ad-cycle-time-content">
                        <div className="ad-cycle-time-main">
                            <span className="ad-cycle-time-icon">⏳</span>
                            <div>
                                <span className="ad-cycle-time-value">
                                    {cycle_time.avg_days != null ? `${cycle_time.avg_days} ngày` : "N/A"}
                                </span>
                                <span className="ad-cycle-time-label">Trung bình</span>
                            </div>
                        </div>
                        <div className="ad-cycle-time-details">
                            <div className="ad-cycle-time-detail">
                                <span className="ad-cycle-detail-label">Nhanh nhất</span>
                                <span className="ad-cycle-detail-value ad-cycle-fast">
                                    {cycle_time.min_days != null ? `${cycle_time.min_days} ngày` : "—"}
                                </span>
                            </div>
                            <div className="ad-cycle-time-detail">
                                <span className="ad-cycle-detail-label">Lâu nhất</span>
                                <span className="ad-cycle-detail-value ad-cycle-slow">
                                    {cycle_time.max_days != null ? `${cycle_time.max_days} ngày` : "—"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Row 5: Overdue + Risk ──────────────────────────────────── */}
            <div className="ad-charts-row ad-charts-row-2">
                <div className="ad-chart-card ad-chart-half">
                    <h3 className="ad-chart-title">🔥 Task quá hạn theo dự án</h3>
                    <p className="ad-chart-desc">Phát hiện dự án có nhiều task trễ deadline</p>
                    <div className="ad-chart-wrap">
                        {overdue_by_project.length > 0 ? (
                            <Bar data={overdueBarData} options={overdueBarOptions} />
                        ) : (
                            <div className="ad-no-data ad-no-data-success">
                                <span>🎉</span>
                                <span>Không có task quá hạn!</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="ad-chart-card ad-chart-half">
                    <h3 className="ad-chart-title">⚡ Phân tích rủi ro</h3>
                    <p className="ad-chart-desc">Cảnh báo rủi ro từ dữ liệu dự án</p>
                    <div className="ad-risk-content">
                        <div className={`ad-risk-item ${summary.overdue > 0 ? "ad-risk-danger" : "ad-risk-ok"}`}>
                            <span className="ad-risk-icon">{summary.overdue > 0 ? "🔴" : "🟢"}</span>
                            <div>
                                <span className="ad-risk-title">Task quá hạn</span>
                                <span className="ad-risk-value">{summary.overdue} task</span>
                            </div>
                        </div>
                        <div className={`ad-risk-item ${summary.unassigned > 0 ? "ad-risk-warn" : "ad-risk-ok"}`}>
                            <span className="ad-risk-icon">{summary.unassigned > 0 ? "🟡" : "🟢"}</span>
                            <div>
                                <span className="ad-risk-title">Task chưa assign</span>
                                <span className="ad-risk-value">{summary.unassigned} task</span>
                            </div>
                        </div>
                        <div className={`ad-risk-item ${summary.progress_percent < 50 ? "ad-risk-warn" : "ad-risk-ok"}`}>
                            <span className="ad-risk-icon">{summary.progress_percent < 50 ? "🟡" : "🟢"}</span>
                            <div>
                                <span className="ad-risk-title">Tiến độ chung</span>
                                <span className="ad-risk-value">{summary.progress_percent}%</span>
                            </div>
                        </div>
                        {projects.filter((p) => p.overdue_tasks > 0).map((p) => (
                            <div key={p.ma_du_an} className="ad-risk-item ad-risk-danger">
                                <span className="ad-risk-icon">🔴</span>
                                <div>
                                    <span className="ad-risk-title">{p.ten_du_an}</span>
                                    <span className="ad-risk-value">{p.overdue_tasks} task quá hạn, tiến độ {p.progress_percent}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Project Progress Table ─────────────────────────────────── */}
            {projects.length > 0 && (
                <div className="ad-chart-card ad-chart-full">
                    <h3 className="ad-chart-title">🗂️ Tiến độ từng dự án</h3>
                    <p className="ad-chart-desc">Chi tiết phân tích timeline từng dự án bạn tham gia</p>
                    <div className="ad-project-table-wrap">
                        <table className="ad-project-table">
                            <thead>
                                <tr>
                                    <th>Dự án</th>
                                    <th>Tổng</th>
                                    <th>Xong</th>
                                    <th>Đang làm</th>
                                    <th>Quá hạn</th>
                                    <th>Tiến độ</th>
                                    <th>Bắt đầu</th>
                                    <th>Kết thúc</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map((p) => (
                                    <tr key={p.ma_du_an}>
                                        <td className="ad-project-name">{p.ten_du_an}</td>
                                        <td>{p.total_tasks}</td>
                                        <td className="ad-td-done">{p.done_tasks}</td>
                                        <td className="ad-td-progress">{p.in_progress_tasks}</td>
                                        <td className={p.overdue_tasks > 0 ? "ad-td-overdue" : ""}>{p.overdue_tasks}</td>
                                        <td>
                                            <div className="ad-progress-cell">
                                                <div className="ad-progress-bar-table">
                                                    <div
                                                        className="ad-progress-fill-table"
                                                        style={{
                                                            width: `${p.progress_percent}%`,
                                                            background: p.progress_percent === 100 ? "#22c55e" : p.progress_percent > 60 ? "#3b82f6" : "#f59e0b",
                                                        }}
                                                    />
                                                </div>
                                                <span className="ad-progress-text">{p.progress_percent}%</span>
                                            </div>
                                        </td>
                                        <td className="ad-td-date">{p.ngay_bat_dau ? new Date(p.ngay_bat_dau).toLocaleDateString("vi-VN") : "—"}</td>
                                        <td className="ad-td-date">{p.ngay_ket_thuc ? new Date(p.ngay_ket_thuc).toLocaleDateString("vi-VN") : "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
