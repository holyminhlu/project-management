"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

/* ── Types ─────────────────────────────────────────────────────────── */
type Resource = {
    id: string;
    name: string;
    active_tasks: number;
    completed_tasks: number;
    active_projects: number;
    status: "optimal" | "overloaded" | "underutilized";
    capacity_rate: number;
};

type Summary = {
    total_resources: number;
    total_active_tasks: number;
    overloaded: number;
    underutilized: number;
    optimal: number;
};

type ResourceAllocationData = {
    summary: Summary;
    resources: Resource[];
};

/* ── Helpers ───────────────────────────────────────────────────────── */
function getInitials(name: string) {
    return name.split(" ").map((w) => w[0]).join("").slice(-2).toUpperCase();
}

function getStatusColor(status: string) {
    if (status === "overloaded") return "#ef4444"; // Red
    if (status === "optimal") return "#10b981"; // Emerald
    return "#64748b"; // Slate
}

function getStatusLabel(status: string) {
    if (status === "overloaded") return "Quá tải";
    if (status === "optimal") return "Hiệu quả";
    return "Còn rảnh";
}

/* ── Component ─────────────────────────────────────────────────────── */
export default function ResourceAllocationClient() {
    const [data, setData] = useState<ResourceAllocationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/analytics/resource-allocation");
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
                <p>Đang tải dữ liệu phân bổ nguồn lực…</p>
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

    const { summary, resources } = data;

    /* ── Doughnut Chart: Capacity Health ──────────────────────────────── */
    const doughnutData = {
        labels: ["Quá tải (>5 CV)", "Hiệu quả (2-5 CV)", "Còn rảnh (0-1 CV)"],
        datasets: [{
            data: [summary.overloaded, summary.optimal, summary.underutilized],
            backgroundColor: ["#ef4444", "#10b981", "#64748b"],
            borderWidth: 0,
            hoverOffset: 10,
            cutout: "70%",
        }],
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom" as const,
                labels: { usePointStyle: true, padding: 20, font: { family: "'Inter', sans-serif", weight: 500 as const } },
            },
            tooltip: {
                padding: 12,
                titleFont: { family: "'Inter', sans-serif", size: 14 },
                bodyFont: { family: "'Inter', sans-serif", size: 13 },
            }
        },
    };

    /* ── Horiz Bar. Active tasks vs completed per user ───────────────── */
    const top10 = [...resources].slice(0, 10);
    const barData = {
        labels: top10.map(r => r.name.split(" ").slice(-2).join(" ")),
        datasets: [
            {
                label: "Đang xử lý",
                data: top10.map(r => r.active_tasks),
                backgroundColor: top10.map(r => getStatusColor(r.status)),
                borderRadius: 4,
                barPercentage: 0.6,
            },
            {
                label: "Dự án thao tác",
                data: top10.map(r => r.active_projects),
                backgroundColor: "rgba(100, 116, 139, 0.2)",
                borderRadius: 4,
                barPercentage: 0.6,
            }
        ]
    };

    const barOptions = {
        indexAxis: "y" as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
        scales: {
            x: { beginAtZero: true, grid: { color: "#f1f5f9" } },
            y: { grid: { display: false } },
        },
    };

    return (
        <div className="tba-container">
            {/* ── Highlighted Summary Section ────────────────────────────── */}
            <div className="ra-highlight-banner">
                <div className="ra-hb-content">
                    <h2 className="ra-hb-title">Tổng quan năng suất</h2>
                    <p className="ra-hb-desc">Hiển thị sức tải công việc của đội ngũ trong toàn dự án. Giám sát lượng tài nguyên để ngăn ngừa rủi ro quá tải.</p>
                    <div className="ra-hb-stats">
                        <div className="ra-hb-stat-item">
                            <span className="ra-hb-stat-val">{summary.total_resources}</span>
                            <span className="ra-hb-stat-lbl">Tham gia nhóm</span>
                        </div>
                        <div className="ra-hb-stat-item">
                            <span className="ra-hb-stat-val">{summary.optimal}</span>
                            <span className="ra-hb-stat-lbl">Đủ việc / Hiệu quả</span>
                        </div>
                        <div className="ra-hb-stat-item">
                            <span className="ra-hb-stat-val">{summary.overloaded}</span>
                            <span className="ra-hb-stat-lbl">Đang bị quá tải</span>
                        </div>
                        <div className="ra-hb-stat-item">
                            <span className="ra-hb-stat-val">{summary.underutilized}</span>
                            <span className="ra-hb-stat-lbl">Chưa có đủ việc</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="tot-charts-row" style={{ marginTop: 24 }}>
                {/* ── Status Doughnut ──────────────────────────────────────── */}
                <div className="tot-chart-card" style={{ flex: 1 }}>
                    <h3 className="tot-chart-title">⚖️ Trạng thái Sức chứa (Capacity)</h3>
                    <p className="tot-chart-desc">Đánh giá chung tình trạng phân bổ đều công việc cho mọi người hay bị dồn việc.</p>
                    <div className="tot-chart-wrap" style={{ height: "300px", marginTop: "1rem" }}>
                        <Doughnut data={doughnutData} options={doughnutOptions} />
                    </div>
                </div>

                {/* ── Workload Breakdown Bar Chart ─────────────────────────── */}
                <div className="tot-chart-card" style={{ flex: 1.5 }}>
                    <h3 className="tot-chart-title">🔥 Top 10 nhân sự có khối lượng lớn nhất</h3>
                    <p className="tot-chart-desc">Lượng công việc đang gánh vác so với số dự án tham gia.</p>
                    <div className="tot-chart-wrap" style={{ height: "300px", marginTop: "1rem" }}>
                        <Bar data={barData} options={barOptions} />
                    </div>
                </div>
            </div>

            {/* ── Detailed Resource Table ─────────────────────────────────── */}
            <div className="tba-table-card" style={{ marginTop: 24 }}>
                <h3 className="tot-chart-title">👤 Thông tin nhân sự chi tiết</h3>
                <p className="tot-chart-desc">Danh sách toàn bộ thành viên, chia tỷ lệ nạp năng lượng công việc cá nhân.</p>
                <div className="tba-table-wrap">
                    <table className="tba-table">
                        <thead>
                            <tr>
                                <th>Nhân sự</th>
                                <th>Dự án tham gia</th>
                                <th>Việc đang làm</th>
                                <th>Đã Hoàn Thành</th>
                                <th>Tình trạng (Capacity)</th>
                                <th>Mức độ nạp (Rate %)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resources.map((r, i) => (
                                <tr key={r.id}>
                                    <td>
                                        <div className="tba-member">
                                            <span className="tba-rank">#{i + 1}</span>
                                            <span
                                                className="tba-avatar"
                                                style={{ background: getStatusColor(r.status), color: "#fff" }}
                                            >
                                                {getInitials(r.name)}
                                            </span>
                                            <div className="tba-member-info">
                                                <span className="tba-name">{r.name}</span>
                                                <span className="tba-member-id">{r.id}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td><strong>{r.active_projects}</strong> <span style={{ fontSize: 11, color: "#94a3b8" }}>dự án</span></td>
                                    <td><span className="tba-badge tba-badge-progress" style={{ background: getStatusColor(r.status), color: "#fff" }}>{r.active_tasks}</span></td>
                                    <td><span className="tba-badge tba-badge-done">{r.completed_tasks}</span></td>
                                    <td>
                                        <span
                                            className={`ra-status-badge ra-status-${r.status}`}
                                        >
                                            {getStatusLabel(r.status)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="ra-capacity-container">
                                            <div className="ra-capacity-bar-bg">
                                                <div
                                                    className="ra-capacity-fill"
                                                    style={{
                                                        width: `${Math.min(r.capacity_rate, 100)}%`,
                                                        background: getStatusColor(r.status),
                                                        opacity: r.status === "overloaded" ? 0.7 : 1
                                                    }}
                                                />
                                                {r.capacity_rate > 100 && (
                                                    <div
                                                        className="ra-capacity-fill-overflow"
                                                        style={{ width: `${Math.min(r.capacity_rate - 100, 100)}%` }}
                                                    />
                                                )}
                                            </div>
                                            <span className="ra-capacity-text" style={{ color: r.status === "overloaded" ? "#ef4444" : "#475569" }}>
                                                {r.capacity_rate}%
                                            </span>
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
