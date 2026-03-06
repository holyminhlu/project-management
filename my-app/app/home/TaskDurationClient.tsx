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
type ChartBracket = {
    label: string;
    count: number;
    color: string;
};

type DurationReportData = {
    summary: {
        total_tasks: number;
        avg_expected_duration: number;
        avg_overdue_days: number;
        total_overdue_tasks: number;
    };
    duration_brackets: ChartBracket[];
    overdue_brackets: ChartBracket[];
    completed_count: number;
};

/* ── Component ─────────────────────────────────────────────────────── */
export default function TaskDurationClient() {
    const [data, setData] = useState<DurationReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/analytics/task-duration");
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
                <p>Đang tải dữ liệu thời gian…</p>
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

    const { summary, duration_brackets, overdue_brackets, completed_count } = data;

    /* ── Doughnut Chart: Expected Duration ────────────────────────────── */
    const doughnutData = {
        labels: duration_brackets.map((b) => b.label),
        datasets: [{
            data: duration_brackets.map((b) => b.count),
            backgroundColor: duration_brackets.map((b) => b.color),
            borderWidth: 2,
            borderColor: "#ffffff",
            hoverOffset: 6,
            cutout: "60%",
        }],
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom" as const,
                labels: { usePointStyle: true, padding: 16, font: { family: "'Be Vietnam Pro', sans-serif" } },
            },
        },
    };

    /* ── Bar Chart: Overdue Severity ──────────────────────────────────── */
    const barData = {
        labels: overdue_brackets.map((b) => b.label),
        datasets: [{
            label: "Số lượng công việc",
            data: overdue_brackets.map((b) => b.count),
            backgroundColor: overdue_brackets.map((b) => b.color),
            borderRadius: 6,
            maxBarThickness: 50,
        }],
    };

    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
        scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } },
            x: { grid: { display: false } },
        },
    };

    return (
        <div className="tba-container">
            {/* ── Summary Cards ──────────────────────────────────────────── */}
            <div className="tot-summary-row">
                <div className="tot-stat-card" style={{ borderLeftColor: "#3b82f6" }}>
                    <span className="tot-stat-icon">🕒</span>
                    <div className="tot-stat-info">
                        <span className="tot-stat-label">TB Thời Gian / CV</span>
                        <span className="tot-stat-value">{summary.avg_expected_duration} <span style={{ fontSize: "13px", fontWeight: "normal" }}>ngày</span></span>
                    </div>
                </div>
                <div className="tot-stat-card" style={{ borderLeftColor: "#ef4444" }}>
                    <span className="tot-stat-icon">⚠️</span>
                    <div className="tot-stat-info">
                        <span className="tot-stat-label">Tổng CV Quá Hạn</span>
                        <span className="tot-stat-value">{summary.total_overdue_tasks}</span>
                    </div>
                </div>
                <div className="tot-stat-card" style={{ borderLeftColor: "#f97316" }}>
                    <span className="tot-stat-icon">⌛</span>
                    <div className="tot-stat-info">
                        <span className="tot-stat-label">TB Trễ Hạn</span>
                        <span className="tot-stat-value">{summary.avg_overdue_days} <span style={{ fontSize: "13px", fontWeight: "normal" }}>ngày</span></span>
                    </div>
                </div>
                <div className="tot-stat-card" style={{ borderLeftColor: "#22c55e" }}>
                    <span className="tot-stat-icon">✅</span>
                    <div className="tot-stat-info">
                        <span className="tot-stat-label">Đã Hoàn Thành</span>
                        <span className="tot-stat-value">{completed_count}</span>
                    </div>
                </div>
            </div>

            <div className="tot-charts-row" style={{ marginTop: 24 }}>
                {/* ── Duration Doughnut ──────────────────────────────────────── */}
                <div className="tot-chart-card" style={{ flex: 1 }}>
                    <h3 className="tot-chart-title">⏳ Thời gian dự kiến hoàn thành</h3>
                    <p className="tot-chart-desc">Phân loại CV dựa theo số ngày từ lúc được giao đến hạn chót (Deadline)</p>
                    <div className="tot-chart-wrap" style={{ height: "300px", marginTop: "1rem" }}>
                        <Doughnut data={doughnutData} options={doughnutOptions} />
                    </div>
                </div>

                {/* ── Overdue Bar Chart ─────────────────────────────────────── */}
                <div className="tot-chart-card" style={{ flex: 1.5 }}>
                    <h3 className="tot-chart-title">🚨 Mức độ trễ hạn của các CV chưa hoàn thành</h3>
                    <p className="tot-chart-desc">Số lượng CV chia theo mức độ quá hạn thực tế so với Deadline</p>
                    <div className="tot-chart-wrap" style={{ height: "300px", marginTop: "1rem" }}>
                        <Bar data={barData} options={barOptions} />
                    </div>
                </div>
            </div>
        </div>
    );
}
