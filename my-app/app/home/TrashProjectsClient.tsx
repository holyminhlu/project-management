"use client";

import { useState } from "react";
import { clientApi } from "@/lib/api/client";

type DeletedProject = {
    ma_du_an: string;
    ten_du_an: string;
    ma_phong_ban: string | null;
};

type Props = {
    initialProjects: DeletedProject[];
};

export default function TrashProjectsClient({ initialProjects }: Props) {
    const [projects, setProjects] = useState(initialProjects);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState("");

    async function restoreProject(projectId: string) {
        setBusyId(projectId);
        setError("");
        const { ok, error } = await clientApi(
            `/api/projects/personal/${encodeURIComponent(projectId)}/restore`,
            { method: "PATCH" },
        );
        if (!ok) {
            setError(error ?? "Không thể khôi phục dự án.");
            setBusyId(null);
            return;
        }
        setProjects((prev) => prev.filter((p) => p.ma_du_an !== projectId));
        setBusyId(null);
    }

    async function permanentDeleteProject(projectId: string, projectName: string) {
        const confirmed = window.confirm(
            `Bạn chắc chắn muốn xóa vĩnh viễn dự án "${projectName}"? Hành động này không thể hoàn tác.`,
        );
        if (!confirmed) return;

        setBusyId(projectId);
        setError("");
        const { ok, error } = await clientApi(
            `/api/projects/personal/${encodeURIComponent(projectId)}/permanent-delete`,
            { method: "PATCH" },
        );
        if (!ok) {
            setError(error ?? "Không thể xóa vĩnh viễn dự án.");
            setBusyId(null);
            return;
        }
        setProjects((prev) => prev.filter((p) => p.ma_du_an !== projectId));
        setBusyId(null);
    }

    return (
        <section className="pm-trash-panel" style={{ marginTop: 16 }}>
            <header className="pm-profile-panel-header">
                <h2 className="pm-profile-title">Dự án đã xóa</h2>
                <p className="pm-profile-subtitle">Khôi phục hoặc xóa vĩnh viễn dự án.</p>
            </header>

            {error ? <p className="pm-profile-error">{error}</p> : null}

            <div className="pm-trash-list">
                {projects.length === 0 ? (
                    <div className="pm-project-empty">Không có dự án nào trong thùng rác.</div>
                ) : (
                    projects.map((project) => (
                        <article key={project.ma_du_an} className="pm-trash-card">
                            <div className="pm-trash-card-head">
                                <h3>{project.ten_du_an}</h3>
                                <span>{project.ma_du_an}</span>
                            </div>
                            <p>Phòng ban: {project.ma_phong_ban || "Không rõ"}</p>

                            <div className="pm-trash-actions">
                                <button
                                    className="pm-trash-restore-btn"
                                    type="button"
                                    disabled={busyId === project.ma_du_an}
                                    onClick={() => void restoreProject(project.ma_du_an)}
                                >
                                    {busyId === project.ma_du_an ? "Đang xử lý..." : "🔄 Khôi phục dự án"}
                                </button>
                                <button
                                    className="pm-trash-permdelete-btn"
                                    type="button"
                                    disabled={busyId === project.ma_du_an}
                                    onClick={() => void permanentDeleteProject(project.ma_du_an, project.ten_du_an)}
                                >
                                    {busyId === project.ma_du_an ? "Đang xử lý..." : "🗑️ Xóa vĩnh viễn"}
                                </button>
                            </div>
                        </article>
                    ))
                )}
            </div>
        </section>
    );
}
