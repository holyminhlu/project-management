"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";

type PersonalProject = {
  ma_du_an: string;
  ten_du_an: string;
  so_luong_cong_viec: number;
  ma_phong_ban?: string | null;
};

type Department = {
  ma_phong_ban: string;
  ten_phong_ban: string;
};

type Member = {
  ma_nhan_vien: string;
  ten_nv: string;
  ma_phong_ban: string | null;
  trang_thai_hoat_dong?: string | null;
};

type Props = {
  initialProjects: PersonalProject[];
  initialDepartments?: Department[];
  initialMembers?: Member[];
};

type ProjectForm = {
  ten_du_an: string;
  ma_phong_ban: string;
  mo_ta: string;
  ngay_bat_dau: string;
  ngay_ket_thuc: string;
  ngay_tao_du_an: string;
  thiet_lap_trien_khai: string;
  thiet_lap_den_han: string;
  muc_do_uu_tien: string;
  member_ids: string[];
};

const DEFAULT_FORM: ProjectForm = {
  ten_du_an: "",
  ma_phong_ban: "",
  mo_ta: "",
  ngay_bat_dau: "",
  ngay_ket_thuc: "",
  ngay_tao_du_an: new Date().toISOString().slice(0, 10),
  thiet_lap_trien_khai: "0",
  thiet_lap_den_han: "0",
  muc_do_uu_tien: "Trung bình",
  member_ids: [],
};

export default function ProjectPickerClient({
  initialProjects,
  initialDepartments = [],
  initialMembers = [],
}: Props) {
  const [projects, setProjects] = useState<PersonalProject[]>(initialProjects);
  const [openCreate, setOpenCreate] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [form, setForm] = useState<ProjectForm>(DEFAULT_FORM);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    if (!form.ma_phong_ban) return [];
    return members.filter((member) => (member.ma_phong_ban || "").trim() === form.ma_phong_ban);
  }, [members, form.ma_phong_ban]);

  const effectiveDepartments = useMemo(() => {
    if (departments.length > 0) return departments;

    const map = new Map<string, Department>();
    for (const member of members) {
      const departmentId = String(member.ma_phong_ban || "").trim();
      if (!departmentId) continue;
      if (!map.has(departmentId)) {
        map.set(departmentId, {
          ma_phong_ban: departmentId,
          ten_phong_ban: departmentId,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.ten_phong_ban.localeCompare(b.ten_phong_ban, "vi"));
  }, [departments, members]);

  // Departments that have at least one project (for the sidebar menu)
  const displayDepts = useMemo(() => {
    const deptIds = new Set(projects.map(p => (p.ma_phong_ban || "").trim()).filter(Boolean));
    // Use effectiveDepartments names if available, else fall back to IDs from projects
    const fromDepts = effectiveDepartments.filter(d => deptIds.has(d.ma_phong_ban));
    if (fromDepts.length > 0) return fromDepts;
    // Derive directly from projects
    const map = new Map<string, Department>();
    for (const p of projects) {
      const id = (p.ma_phong_ban || "").trim();
      if (!id) continue;
      if (!map.has(id)) map.set(id, { ma_phong_ban: id, ten_phong_ban: id });
    }
    return Array.from(map.values()).sort((a, b) => a.ten_phong_ban.localeCompare(b.ten_phong_ban, "vi"));
  }, [effectiveDepartments, projects]);

  const displayedProjects = useMemo(() => {
    if (!selectedDeptId) return projects;
    return projects.filter(p => (p.ma_phong_ban || "").trim() === selectedDeptId);
  }, [projects, selectedDeptId]);

  async function fetchSetupData() {
    const setupEndpoints = ["/api/tasks/personal/setup", "/api/projects/personal/setup", "/api/projects/personal?setup=1"];
    for (const endpoint of setupEndpoints) {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as {
        departments?: Department[];
        members?: Member[];
        error?: string;
      };
      if (response.ok) return data;
      if (response.status !== 404) {
        throw new Error(data.error || "Không thể tải dữ liệu tạo dự án.");
      }
    }

    throw new Error("Không thể tải danh sách phòng ban. Vui lòng tải lại trang.");
  }

  async function openCreateModal() {
    setOpenCreate(true);
    setError("");
    if (departments.length > 0 && members.length > 0) return;

    setLoadingSetup(true);
    try {
      const data = await fetchSetupData();
      setDepartments(Array.isArray(data.departments) ? data.departments : []);
      setMembers(Array.isArray(data.members) ? data.members : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể kết nối máy chủ.";
      setError(message);
    } finally {
      setLoadingSetup(false);
    }
  }

  function closeCreateModal() {
    setOpenCreate(false);
    setError("");
    setForm(DEFAULT_FORM);
  }

  async function submitCreateProject() {
    const ten_du_an = form.ten_du_an.trim();
    if (!ten_du_an) {
      setError("Vui lòng nhập tên dự án.");
      return;
    }
    if (!form.ma_phong_ban) {
      setError("Vui lòng chọn phòng ban.");
      return;
    }
    if (!form.ngay_bat_dau || !form.ngay_ket_thuc) {
      setError("Vui lòng chọn ngày bắt đầu và ngày kết thúc.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const payload = {
        ten_du_an,
        ma_phong_ban: form.ma_phong_ban,
        mo_ta: form.mo_ta.trim(),
        ngay_bat_dau: form.ngay_bat_dau,
        ngay_ket_thuc: form.ngay_ket_thuc,
        ngay_tao_du_an: form.ngay_tao_du_an,
        thiet_lap_trien_khai: Number.parseInt(form.thiet_lap_trien_khai || "0", 10) || 0,
        thiet_lap_den_han: Number.parseInt(form.thiet_lap_den_han || "0", 10) || 0,
        muc_do_uu_tien: form.muc_do_uu_tien,
        member_ids: form.member_ids,
      };
      const response = await fetch("/api/projects/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as {
        project?: PersonalProject;
        error?: string;
      };
      if (!response.ok || !data.project) {
        setError(data.error || "Không thể tạo dự án.");
        return;
      }

      setProjects((prev) =>
        [data.project as PersonalProject, ...prev].sort((a, b) => a.ten_du_an.localeCompare(b.ten_du_an, "vi")),
      );
      closeCreateModal();
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteProject(projectId: string, projectName: string) {
    const confirmed = window.confirm(`Bạn có chắc muốn xóa dự án "${projectName}"?`);
    if (!confirmed) return;

    setDeletingProjectId(projectId);
    setError("");
    try {
      const response = await fetch(`/api/projects/personal/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Không thể xóa dự án.");
        return;
      }
      setProjects((prev) => prev.filter((p) => p.ma_du_an !== projectId));
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setDeletingProjectId(null);
    }
  }

  return (
    <>
      {error ? <p className="pm-profile-error">{error}</p> : null}

      <div className="pm-dept-layout">
        {/* Department sidebar */}
        {displayDepts.length > 0 && (
          <aside className="pm-dept-sidebar">
            <div className="pm-dept-sidebar-title">Phòng ban</div>
            <button
              type="button"
              className={`pm-dept-menu-item${selectedDeptId === null ? " active" : ""}`}
              onClick={() => setSelectedDeptId(null)}
            >
              <span className="pm-dept-menu-name">Tất cả</span>
              <span className="pm-dept-menu-count">{projects.length}</span>
            </button>
            {displayDepts.map((dept) => {
              const count = projects.filter(p => (p.ma_phong_ban || "").trim() === dept.ma_phong_ban).length;
              return (
                <button
                  key={dept.ma_phong_ban}
                  type="button"
                  className={`pm-dept-menu-item${selectedDeptId === dept.ma_phong_ban ? " active" : ""}`}
                  onClick={() => setSelectedDeptId(dept.ma_phong_ban)}
                >
                  <span className="pm-dept-menu-name">{dept.ten_phong_ban}</span>
                  <span className="pm-dept-menu-count">{count}</span>
                </button>
              );
            })}
          </aside>
        )}

        {/* Project grid */}
        <div className="pm-dept-content">
          {selectedDeptId !== null && (
            <div className="pm-dept-content-header">
              <h3 className="pm-dept-content-title">
                {displayDepts.find(d => d.ma_phong_ban === selectedDeptId)?.ten_phong_ban || selectedDeptId}
              </h3>
              <span className="pm-dept-content-count">{displayedProjects.length} dự án</span>
            </div>
          )}
          <div className="pm-project-grid">
            {displayedProjects.map((project) => (
              <Link
                key={project.ma_du_an}
                href={`/home?view=personal-tasks&project=${encodeURIComponent(project.ma_du_an)}`}
                className="pm-project-card"
              >
                <div className="pm-project-card-head">
                  <h3>{project.ten_du_an}</h3>
                  <span className="pm-project-count">{project.so_luong_cong_viec}</span>
                </div>
                <dl className="pm-project-info">
                  <div>
                    <dt>Mã dự án</dt>
                    <dd>{project.ma_du_an}</dd>
                  </div>
                  <div>
                    <dt>Công việc</dt>
                    <dd>{project.so_luong_cong_viec} mục</dd>
                  </div>
                  {project.ma_phong_ban && (
                    <div>
                      <dt>Phòng ban</dt>
                      <dd>
                        {displayDepts.find(d => d.ma_phong_ban === project.ma_phong_ban)?.ten_phong_ban || project.ma_phong_ban}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="pm-project-card-footer">
                  <div className="pm-project-card-cta">Vào công việc dự án</div>
                  <button
                    className="pm-project-delete-btn"
                    type="button"
                    title="Xóa dự án"
                    disabled={deletingProjectId === project.ma_du_an}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void deleteProject(project.ma_du_an, project.ten_du_an);
                    }}
                  >
                    <Image src="/icon/bin.png" alt="Xóa" width={14} height={14} />
                  </button>
                </div>
              </Link>
            ))}

            <button className="pm-project-add-card" type="button" onClick={() => void openCreateModal()}>
              <span className="pm-project-add-icon">+</span>
              <span className="pm-project-add-text">Thêm dự án</span>
            </button>

            {displayedProjects.length === 0 && projects.length > 0 ? (
              <div className="pm-project-empty">Không có dự án trong phòng ban này.</div>
            ) : projects.length === 0 ? (
              <div className="pm-project-empty">Bạn chưa tham gia dự án nào.</div>
            ) : null}
          </div>
        </div>
      </div>

      {openCreate ? (
        <div
          className="pm-project-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCreateModal();
          }}
        >
          <div className="pm-project-modal">
            <header className="pm-project-modal-head">
              <h3>Tạo dự án mới</h3>
              <button className="pm-project-modal-close" type="button" onClick={closeCreateModal}>
                ×
              </button>
            </header>

            <div className="pm-project-modal-body">
              <label className="pm-project-form-field">
                <span>Tên dự án</span>
                <input
                  value={form.ten_du_an}
                  onChange={(e) => setForm((prev) => ({ ...prev, ten_du_an: e.target.value }))}
                  placeholder="Nhập tên dự án"
                />
              </label>

              <label className="pm-project-form-field">
                <span>Chọn phòng ban</span>
                <select
                  value={form.ma_phong_ban}
                  onChange={(e) => {
                    const nextDepartment = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      ma_phong_ban: nextDepartment,
                      member_ids: prev.member_ids.filter((id) =>
                        members.some(
                          (member) =>
                            member.ma_nhan_vien === id && (member.ma_phong_ban || "").trim() === nextDepartment,
                        ),
                      ),
                    }));
                  }}
                  disabled={loadingSetup}
                >
                  <option value="">-- Chọn phòng ban --</option>
                  {effectiveDepartments.map((department) => (
                    <option key={department.ma_phong_ban} value={department.ma_phong_ban}>
                      {department.ten_phong_ban}
                    </option>
                  ))}
                </select>
              </label>

              <label className="pm-project-form-field">
                <span>Nhập mô tả</span>
                <textarea
                  value={form.mo_ta}
                  onChange={(e) => setForm((prev) => ({ ...prev, mo_ta: e.target.value }))}
                  placeholder="Mô tả dự án"
                  rows={3}
                />
              </label>

              <div className="pm-project-form-grid">
                <label className="pm-project-form-field">
                  <span>Chọn ngày bắt đầu</span>
                  <input
                    type="date"
                    value={form.ngay_bat_dau}
                    onChange={(e) => setForm((prev) => ({ ...prev, ngay_bat_dau: e.target.value }))}
                  />
                </label>
                <label className="pm-project-form-field">
                  <span>Ngày kết thúc</span>
                  <input
                    type="date"
                    value={form.ngay_ket_thuc}
                    onChange={(e) => setForm((prev) => ({ ...prev, ngay_ket_thuc: e.target.value }))}
                  />
                </label>
                <label className="pm-project-form-field">
                  <span>Ngày tạo dự án</span>
                  <input
                    type="date"
                    value={form.ngay_tao_du_an}
                    onChange={(e) => setForm((prev) => ({ ...prev, ngay_tao_du_an: e.target.value }))}
                  />
                </label>
                <label className="pm-project-form-field">
                  <span>Thiết lập thời gian dự án sắp triển khai (ngày)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.thiet_lap_trien_khai}
                    onChange={(e) => setForm((prev) => ({ ...prev, thiet_lap_trien_khai: e.target.value }))}
                  />
                </label>
                <label className="pm-project-form-field">
                  <span>Thiết lập thời gian dự án sắp đến hạn (ngày)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.thiet_lap_den_han}
                    onChange={(e) => setForm((prev) => ({ ...prev, thiet_lap_den_han: e.target.value }))}
                  />
                </label>
                <label className="pm-project-form-field">
                  <span>Mức độ ưu tiên</span>
                  <select
                    value={form.muc_do_uu_tien}
                    onChange={(e) => setForm((prev) => ({ ...prev, muc_do_uu_tien: e.target.value }))}
                  >
                    <option value="Thấp">Thấp</option>
                    <option value="Trung bình">Trung bình</option>
                    <option value="Cao">Cao</option>
                  </select>
                </label>
              </div>

              <div className="pm-project-form-field">
                <span>Thêm thành viên (theo phòng ban đã chọn)</span>
                <div className="pm-project-member-picker">
                  {!form.ma_phong_ban ? (
                    <p className="pm-project-member-picker-empty">Vui lòng chọn phòng ban trước.</p>
                  ) : filteredMembers.length === 0 ? (
                    <p className="pm-project-member-picker-empty">Không có thành viên phù hợp.</p>
                  ) : (
                    filteredMembers.map((member) => {
                      const checked = form.member_ids.includes(member.ma_nhan_vien);
                      const isInactive = member.trang_thai_hoat_dong && (
                        member.trang_thai_hoat_dong.toLowerCase().includes("nghỉ") ||
                        member.trang_thai_hoat_dong.toLowerCase().includes("nghi") ||
                        member.trang_thai_hoat_dong.toLowerCase().includes("inactive") ||
                        member.trang_thai_hoat_dong.toLowerCase().includes("tạm") ||
                        member.trang_thai_hoat_dong.toLowerCase().includes("tam")
                      );
                      return (
                        <label key={member.ma_nhan_vien} className={`pm-project-member-option${isInactive ? " pm-project-member-inactive" : ""}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setForm((prev) => ({
                                ...prev,
                                member_ids: isChecked
                                  ? [...prev.member_ids, member.ma_nhan_vien]
                                  : prev.member_ids.filter((id) => id !== member.ma_nhan_vien),
                              }));
                            }}
                          />
                          <span>{member.ten_nv}{isInactive ? <em className="pm-project-member-status-badge"> ({member.trang_thai_hoat_dong})</em> : null}</span>
                          <small>{member.ma_nhan_vien}</small>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <footer className="pm-project-modal-actions">
              <button className="pm-tool-btn" type="button" onClick={closeCreateModal}>
                Hủy
              </button>
              <button className="pm-tool-refresh" type="button" onClick={() => void submitCreateProject()} disabled={submitting}>
                {submitting ? "Đang tạo..." : "Tạo dự án"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
