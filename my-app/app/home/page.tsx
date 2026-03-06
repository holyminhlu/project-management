import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { serverApi } from "@/lib/api/server";
import AvatarMenu from "./AvatarMenu";
import ProjectPickerClient from "./ProjectPickerClient";
import TaskColumnsClient from "./TaskColumnsClient";
import TrashTasksClient from "./TrashTasksClient";
import TrashProjectsClient from "./TrashProjectsClient";
import AnalyticsDashboardClient from "./AnalyticsDashboardClient";
import EisenhowerMatrixClient from "./EisenhowerMatrixClient";
import TasksOverTimeClient from "./TasksOverTimeClient";
import TasksByAssigneeClient from "./TasksByAssigneeClient";
import TasksByRelatedClient from "./TasksByRelatedClient";
import TaskDurationClient from "./TaskDurationClient";
import ResourceAllocationClient from "./ResourceAllocationClient";

type HeaderIcon = {
  title: string;
  src: string;
  alt: string;
  showBadge?: boolean;
};

type HomePageProps = {
  searchParams?:
  | {
    view?: string | string[];
    sort?: string | string[];
    project?: string | string[];
    report?: string | string[];
  }
  | Promise<{
    view?: string | string[];
    sort?: string | string[];
    project?: string | string[];
    report?: string | string[];
  }>;
};

type ProfileUser = {
  ma_nhan_vien: string;
  ten_nv: string;
  email: string;
  ten_vai_tro?: string | null;
  ten_phong_ban?: string | null;
};

type MeResponse = {
  user?: ProfileUser;
  error?: string;
};

type TaskStatusKey = "todo" | "in_progress" | "done";

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
  assignees?: { ma_nhan_vien: string; ten_nv: string }[];
};

type PersonalTasksResponse = {
  tasks?: PersonalTask[];
  error?: string;
};

type DeletedTask = {
  ma_cong_viec: string;
  tieu_de: string;
  ten_du_an: string | null;
  deleted_at: string | null;
  ten_nguoi_xoa: string | null;
};

type DeletedTasksResponse = {
  tasks?: DeletedTask[];
  error?: string;
};

type DeletedProject = {
  ma_du_an: string;
  ten_du_an: string;
  ma_phong_ban: string | null;
};

type DeletedProjectsResponse = {
  projects?: DeletedProject[];
  error?: string;
};

type PersonalProject = {
  ma_du_an: string;
  ten_du_an: string;
  so_luong_cong_viec: number;
  ma_phong_ban?: string | null;
};

type PersonalProjectsResponse = {
  projects?: PersonalProject[];
  error?: string;
};

type DepartmentItem = {
  ma_phong_ban: string;
  ten_phong_ban: string;
};

type ProjectSetupResponse = {
  departments?: DepartmentItem[];
  members?: unknown[];
  error?: string;
};

const headerIcons: HeaderIcon[] = [
  { title: "Giỏ hàng", src: "/icon/cart.png", alt: "Cart", showBadge: true },
  { title: "Tìm kiếm", src: "/icon/search.png", alt: "Search" },
  { title: "Cài đặt", src: "/icon/setting.png", alt: "Setting" },
  { title: "Thêm bạn bè", src: "/icon/addfriends.png", alt: "Add friends" },
  { title: "Nhắn tin", src: "/icon/message.png", alt: "Message" },
  { title: "Thông báo", src: "/icon/bell.png", alt: "Bell", showBadge: true },
  { title: "Trợ giúp", src: "/icon/question.jpg", alt: "Question" },
  { title: "Tiện ích", src: "/icon/miscell.png", alt: "Misc" },
  { title: "Thêm", src: "/icon/more.png", alt: "More" },
];

export const metadata: Metadata = {
  title: "Trang chủ - Quản lý dự án",
  description: "Trang chủ quản lý công việc cá nhân",
};

function toInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0][0] || "";
  const last = parts[parts.length - 1][0] || "";
  return `${first}${last}`.toUpperCase();
}

async function getProfile(accessToken: string): Promise<MeResponse> {
  const { data, ok } = await serverApi<MeResponse>("auth", "/auth/me", { token: accessToken });
  if (!ok || !data?.user) return { error: data?.error ?? "Không thể tải thông tin cá nhân." };
  return { user: data.user };
}

async function getPersonalTasks(accessToken: string): Promise<PersonalTasksResponse> {
  const { data, ok } = await serverApi<PersonalTasksResponse>("tasks", "/tasks/personal", { token: accessToken });
  if (!ok || !Array.isArray(data?.tasks)) return { error: data?.error ?? "Không thể tải công việc cá nhân." };
  return { tasks: data!.tasks };
}

async function getPersonalProjects(accessToken: string): Promise<PersonalProjectsResponse> {
  const { data, ok } = await serverApi<PersonalProjectsResponse>("projects", "/projects/personal", { token: accessToken });
  if (!ok || !Array.isArray(data?.projects)) return { error: data?.error ?? "Không thể tải dự án cá nhân." };
  return { projects: data!.projects };
}

type ProjectMember = {
  ma_nhan_vien: string;
  ten_nv: string;
  ma_phong_ban: string | null;
  vai_tro: string | null;
};

type ProjectMembersResponse = {
  members?: ProjectMember[];
  error?: string;
};

async function getProjectMembers(accessToken: string, projectId: string): Promise<ProjectMembersResponse> {
  const { data, ok } = await serverApi<ProjectMembersResponse>(
    "projects",
    `/projects/personal/${encodeURIComponent(projectId)}/members`,
    { token: accessToken },
  );
  if (!ok || !Array.isArray(data?.members)) return { error: data?.error ?? "Không thể tải thành viên dự án." };
  return { members: data!.members };
}

async function getDeletedTasks(accessToken: string): Promise<DeletedTasksResponse> {
  const { data, ok } = await serverApi<DeletedTasksResponse>("tasks", "/tasks/personal/deleted", { token: accessToken });
  if (!ok || !Array.isArray(data?.tasks)) return { error: data?.error ?? "Không thể tải công việc đã xóa." };
  return { tasks: data!.tasks };
}

async function getProjectDepartments(accessToken: string): Promise<DepartmentItem[]> {
  const { data, ok } = await serverApi<ProjectSetupResponse>("projects", "/projects/personal/setup", { token: accessToken });
  if (!ok || !Array.isArray(data?.departments)) return [];
  return data!.departments!;
}

async function getDeletedProjects(accessToken: string): Promise<DeletedProjectsResponse> {
  const { data, ok } = await serverApi<DeletedProjectsResponse>("projects", "/projects/personal/deleted", { token: accessToken });
  if (!ok || !Array.isArray(data?.projects)) return { error: data?.error ?? "Không thể tải dự án đã xóa." };
  return { projects: data!.projects };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("pm_access")?.value;
  const viewParam = resolvedSearchParams?.view;
  const sortParam = resolvedSearchParams?.sort;
  const projectParam = resolvedSearchParams?.project;
  const currentView = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  const currentSort = Array.isArray(sortParam) ? sortParam[0] : sortParam;
  const currentProject = Array.isArray(projectParam) ? projectParam[0] : projectParam;
  const isProfileView = currentView === "profile";
  const isPersonalTasksView = currentView === "personal-tasks";
  const isTrashView = currentView === "trash";
  const isReportsView = currentView === "reports";
  const isAnalyticsView = currentView === "analytics";
  const reportParam = resolvedSearchParams?.report;
  const currentReport = Array.isArray(reportParam) ? reportParam[0] : reportParam;
  const isSortEnabled = currentSort === "due_asc";

  // Auth/JWT verification is handled by backend endpoints and middleware.
  const meResult = accessToken ? await getProfile(accessToken) : null;
  const displayName = meResult?.user?.ten_nv ?? "";
  const initials = toInitials(displayName);
  const profile = isProfileView ? meResult : null;
  const personalProjectResult = isPersonalTasksView && accessToken ? await getPersonalProjects(accessToken) : null;
  const personalTaskResult = isPersonalTasksView && accessToken ? await getPersonalTasks(accessToken) : null;
  const deletedTaskResult = isTrashView && accessToken ? await getDeletedTasks(accessToken) : null;
  const deletedProjectResult = isTrashView && accessToken ? await getDeletedProjects(accessToken) : null;
  const selectedProjectId = typeof currentProject === "string" && currentProject.trim() ? currentProject.trim() : "";
  const projectDepartments = isPersonalTasksView && !selectedProjectId && accessToken ? await getProjectDepartments(accessToken) : [];
  const allTasks = personalTaskResult?.tasks || [];
  const projectMap = new Map<string, PersonalProject>();
  for (const task of allTasks) {
    const projectKey = (task.ma_du_an || task.ten_du_an || "").trim();
    if (!projectKey) continue;
    const existing = projectMap.get(projectKey);
    if (existing) {
      existing.so_luong_cong_viec += 1;
    } else {
      projectMap.set(projectKey, {
        ma_du_an: projectKey,
        ten_du_an: task.ten_du_an || projectKey,
        so_luong_cong_viec: 1,
      });
    }
  }
  const taskDerivedProjects = Array.from(projectMap.values()).sort((a, b) => a.ten_du_an.localeCompare(b.ten_du_an, "vi"));
  const personalProjects = (personalProjectResult?.projects || taskDerivedProjects)
    .slice()
    .sort((a, b) => a.ten_du_an.localeCompare(b.ten_du_an, "vi"));
  const selectedProject = personalProjects.find((item) => item.ma_du_an === selectedProjectId) || null;
  const projectTasks = selectedProjectId
    ? allTasks.filter((task) => (task.ma_du_an || task.ten_du_an || "").trim() === selectedProjectId)
    : [];
  const totalProjects = personalProjects.length;
  const totalProjectTasks = personalProjects.reduce((sum, project) => sum + project.so_luong_cong_viec, 0);
  const avgTasksPerProject = totalProjects > 0 ? (totalProjectTasks / totalProjects).toFixed(1) : "0";
  const taskList = projectTasks.slice().sort((a, b) => {
    if (!isSortEnabled) return 0;
    const aTime = a.han_hoan_thanh ? new Date(a.han_hoan_thanh).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.han_hoan_thanh ? new Date(b.han_hoan_thanh).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
  // Nhiệm vụ 3: Fetch real project members from thanh_vien_nhom
  const projectMembersResult =
    isPersonalTasksView && accessToken && selectedProjectId
      ? await getProjectMembers(accessToken, selectedProjectId)
      : null;

  const projectMembers = (() => {
    // Use real members from API if available
    const apiMembers = projectMembersResult?.members;
    if (apiMembers && apiMembers.length > 0) {
      return apiMembers.map((m) => ({
        id: m.ma_nhan_vien,
        name: m.ten_nv,
        initials: toInitials(m.ten_nv),
        ma_nhan_vien: m.ma_nhan_vien,
      })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
    }
    // Fallback: derive from task assignees
    const memberMap = new Map<string, { id: string; name: string; initials: string; ma_nhan_vien: string }>();
    for (const task of projectTasks) {
      const assignees = task.assignees || [];
      for (const a of assignees) {
        if (!memberMap.has(a.ma_nhan_vien)) {
          memberMap.set(a.ma_nhan_vien, {
            id: a.ma_nhan_vien,
            name: a.ten_nv,
            initials: toInitials(a.ten_nv),
            ma_nhan_vien: a.ma_nhan_vien,
          });
        }
      }
    }
    return Array.from(memberMap.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  })();

  return (
    <div className="pm-home">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Image className="logo-image" src="/icon/3x3.svg" alt="Logo" width={18} height={18} />
          </div>
          <span>Công việc</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-item">
            <span className="nav-icon">
              <Image className="sidebar-icon-image" src="/icon/home.png" alt="Home" width={16} height={16} />
            </span>{" "}
            Tổng quan
          </div>
          <div className="nav-item">
            <span className="nav-icon">
              <Image
                className="sidebar-icon-image"
                src="/icon/complete.png"
                alt="Complete"
                width={16}
                height={16}
              />
            </span>{" "}
            Việc của tôi
          </div>
          <Link href="/home?view=analytics" className={`nav-item ${isAnalyticsView ? "active" : ""}`}>
            <span className="nav-icon">
              <Image className="sidebar-icon-image" src="/icon/chart.png" alt="Analytics" width={16} height={16} />
            </span>{" "}
            Phân tích công việc
          </Link>
          <details className="nav-group" open={isReportsView || undefined}>
            <summary className="nav-group-label">
              <span className="nav-icon">
                <Image className="sidebar-icon-image" src="/icon/chart.png" alt="Chart" width={16} height={16} />
              </span>
              Báo cáo
            </summary>
            <div className="nav-report-section">Báo cáo mặc định</div>
            <Link href="/home?view=reports&report=eisenhower" className={`nav-subitem ${currentReport === "eisenhower" ? "active" : ""}`}>
              Phân loại theo Eisenhower
            </Link>
            <Link href="/home?view=reports&report=slcv-thoi-gian" className={`nav-subitem ${currentReport === "slcv-thoi-gian" ? "active" : ""}`}>
              Số lượng CV theo thời gian
            </Link>
            <Link href="/home?view=reports&report=slcv-nguoi-thuc-hien" className={`nav-subitem ${currentReport === "slcv-nguoi-thuc-hien" ? "active" : ""}`}>
              Số lượng CV theo người thực hiện
            </Link>
            <Link href="/home?view=reports&report=slcv-nguoi-lien-quan" className={`nav-subitem ${currentReport === "slcv-nguoi-lien-quan" ? "active" : ""}`}>
              Số lượng CV theo người liên quan
            </Link>
            <Link href="/home?view=reports&report=thoi-gian-thuc-hien" className={`nav-subitem ${currentReport === "thoi-gian-thuc-hien" ? "active" : ""}`}>
              Thời gian thực hiện công việc
            </Link>
            <Link href="/home?view=reports&report=phan-bo-nguon-luc" className={`nav-subitem ${currentReport === "phan-bo-nguon-luc" ? "active" : ""}`}>
              Phân bổ nguồn lực
            </Link>
            <Link href="/home?view=reports&report=tinh-trang-thuc-hien" className={`nav-subitem ${currentReport === "tinh-trang-thuc-hien" ? "active" : ""}`}>
              Tình trạng thực hiện công việc
            </Link>
            <Link href="/home?view=reports&report=giao-cho-toi" className={`nav-subitem ${currentReport === "giao-cho-toi" ? "active" : ""}`}>
              Việc giao cho tôi
            </Link>
            <Link href="/home?view=reports&report=lui-han" className={`nav-subitem ${currentReport === "lui-han" ? "active" : ""}`}>
              Tình hình lùi hạn công việc
            </Link>
            <Link href="/home?view=reports&report=trien-khai-da" className={`nav-subitem ${currentReport === "trien-khai-da" ? "active" : ""}`}>
              Tình hình triển khai dự án
            </Link>
            <Link href="/home?view=reports&report=gantt" className={`nav-subitem ${currentReport === "gantt" ? "active" : ""}`}>
              Sơ đồ Gantt
            </Link>
            <Link href="/home?view=reports&report=hoat-dong-da" className={`nav-subitem ${currentReport === "hoat-dong-da" ? "active" : ""}`}>
              Tình hình hoạt động dự án
            </Link>
            <Link href="/home?view=reports&report=toi-tao" className={`nav-subitem ${currentReport === "toi-tao" ? "active" : ""}`}>
              Tôi tạo
            </Link>
            <div className="nav-report-section">Chia sẻ với tôi</div>
            <Link href="/home?view=reports&report=chia-se-voi-toi" className={`nav-subitem ${currentReport === "chia-se-voi-toi" ? "active" : ""}`}>
              Báo cáo chia sẻ với tôi
            </Link>
          </details>

          <div className="nav-section">Không gian làm việc</div>

          <details className="nav-group" open>
            <summary className="nav-group-label">
              <span style={{ fontSize: 12 }}>▾</span> Cá nhân
            </summary>
            <Link
              href="/home?view=personal-tasks"
              className={`nav-subitem ${isPersonalTasksView ? "active" : ""}`}
            >
              <span className="nav-icon">
                <Image className="sidebar-icon-image" src="/icon/canhan.png" alt="Cá nhân" width={16} height={16} />
              </span>
              Công việc cá nhân
            </Link>
          </details>
        </nav>

        <div className="sidebar-trash">
          <div className="trash-header">
            <span style={{ fontSize: 15 }}>🗑️</span> Thùng rác <span className="chevron">▲</span>
          </div>
          <Link href="/home?view=trash" className={`trash-sub ${isTrashView ? "active" : ""}`}>
            <span style={{ fontSize: 13 }}>🔄</span> Công việc đã xóa
          </Link>
          <Link href="/home?view=trash" className={`trash-sub ${isTrashView ? "active" : ""}`}>
            <span style={{ fontSize: 13 }}>📁</span> Dự án đã xóa
          </Link>
        </div>
      </aside>

      <div className="main">
        <header className="topnav">
          <div className="topnav-left" />
          <div className="topnav-right">
            <button className="btn-outline" type="button">
              <span>▶</span> Bắt đầu sử dụng
            </button>
            <button className="btn-primary" type="button">
              <span style={{ fontSize: 16 }}>＋</span> Thêm công việc{" "}
              <span className="chevron" style={{ fontSize: 9, opacity: 0.8 }}>
                ▼
              </span>
            </button>

            <div style={{ width: 6 }} />

            {headerIcons.map((icon) => (
              <button
                key={icon.src}
                className="icon-btn"
                title={icon.title}
                type="button"
                style={icon.title === "Thông báo" ? { position: "relative" } : undefined}
              >
                <Image className="icon-image" src={icon.src} alt={icon.alt} width={18} height={18} />
                {icon.showBadge ? (
                  <span
                    className="badge-dot"
                    style={icon.title === "Thông báo" ? { background: "#e74c5e" } : undefined}
                  />
                ) : null}
              </button>
            ))}
            <AvatarMenu initials={initials} displayName={displayName} />
          </div>
        </header>

        <section className="pm-main-content">
          {isProfileView ? (
            <article className="pm-profile-panel" aria-label="Thông tin cá nhân">
              <header className="pm-profile-panel-header">
                <h1 className="pm-profile-title">Thông tin cá nhân của bạn</h1>
                <p className="pm-profile-subtitle"></p>
              </header>

              {profile?.user ? (
                <div className="pm-profile-grid" aria-label="Thông tin người dùng">
                  <div className="pm-profile-row">
                    <span className="pm-profile-label">Họ tên</span>
                    <span className="pm-profile-value">{profile.user.ten_nv}</span>
                  </div>
                  <div className="pm-profile-row">
                    <span className="pm-profile-label">Email</span>
                    <span className="pm-profile-value">{profile.user.email}</span>
                  </div>
                  <div className="pm-profile-row">
                    <span className="pm-profile-label">Mã nhân viên</span>
                    <span className="pm-profile-value">{profile.user.ma_nhan_vien}</span>
                  </div>
                  {profile.user.ten_vai_tro ? (
                    <div className="pm-profile-row">
                      <span className="pm-profile-label">Vai trò</span>
                      <span className="pm-profile-value">{profile.user.ten_vai_tro}</span>
                    </div>
                  ) : null}
                  {profile.user.ten_phong_ban ? (
                    <div className="pm-profile-row">
                      <span className="pm-profile-label">Phòng ban</span>
                      <span className="pm-profile-value">{profile.user.ten_phong_ban}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="pm-profile-error">{profile?.error || "Không thể tải thông tin cá nhân."}</p>
              )}
            </article>
          ) : isPersonalTasksView ? (
            <section className="pm-personal-tasks" aria-label="Công việc cá nhân">
              {!selectedProjectId ? (
                <>
                  <section className="pm-project-overview">
                    <header className="pm-project-picker-head">
                      <h2 className="pm-profile-title">Dự án bạn tham gia</h2>
                      <p className="pm-profile-subtitle">Chọn dự án để vào trang công việc của dự án đó.</p>
                    </header>
                    <div className="pm-project-stats" aria-label="Tổng quan dự án">
                      <article className="pm-project-stat-card">
                        <p>Dự án tham gia</p>
                        <strong>{totalProjects}</strong>
                      </article>
                      <article className="pm-project-stat-card">
                        <p>Tổng công việc</p>
                        <strong>{totalProjectTasks}</strong>
                      </article>
                      <article className="pm-project-stat-card">
                        <p>TB công việc / dự án</p>
                        <strong>{avgTasksPerProject}</strong>
                      </article>
                    </div>
                  </section>

                  {personalProjectResult?.error ? <p className="pm-profile-error">{personalProjectResult.error}</p> : null}
                  {personalTaskResult?.error ? <p className="pm-profile-error">{personalTaskResult.error}</p> : null}

                  <ProjectPickerClient initialProjects={personalProjects} initialDepartments={projectDepartments} />
                </>
              ) : (
                <>
                  <div className="pm-task-projectbar">
                    <Link className="pm-tool-btn" href="/home?view=personal-tasks">
                      Quay lại chọn dự án
                    </Link>
                    <span className="pm-current-project">{selectedProject?.ten_du_an || selectedProjectId}</span>
                    <div className="pm-project-members">
                      <span className="pm-project-members-label">Các thành viên dự án</span>
                      <div className="pm-project-member-avatars">
                        {projectMembers.length === 0 ? (
                          <span className="pm-project-members-empty">Chưa có</span>
                        ) : (
                          projectMembers.slice(0, 5).map((member, idx) => (
                            <span
                              key={member.id}
                              className={`pm-project-member-avatar pm-project-member-avatar-${(idx % 5) + 1}`}
                              title={member.name}
                              style={{ zIndex: 20 - idx }}
                            >
                              {member.initials}
                            </span>
                          ))
                        )}
                        {projectMembers.length > 5 ? (
                          <span className="pm-project-member-more">+{projectMembers.length - 5}</span>
                        ) : null}
                      </div>
                      <details className="pm-project-members-menu">
                        <summary className="pm-project-members-more" aria-label="Mở danh sách thành viên">
                          ...
                        </summary>
                        <div className="pm-project-members-dropdown">
                          {projectMembers.length === 0 ? (
                            <p className="pm-project-members-empty-list">Không có thành viên trong dự án.</p>
                          ) : (
                            <ul className="pm-project-members-list">
                              {projectMembers.map((member, idx) => (
                                <li key={`${member.id}-list`}>
                                  <span className={`pm-project-members-list-avatar pm-project-member-avatar-${(idx % 5) + 1}`}>
                                    {member.initials}
                                  </span>
                                  <span className="pm-project-members-list-name">{member.name}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </details>
                    </div>
                  </div>

                  <TaskColumnsClient
                    selectedProjectId={selectedProjectId}
                    selectedProjectName={selectedProject?.ten_du_an || selectedProjectId}
                    initialTasks={taskList}
                    isSortEnabled={isSortEnabled}
                    projectMembers={projectMembers.map((m) => ({ ma_nhan_vien: m.id, ten_nv: m.name }))}
                  />
                </>
              )}
            </section>
          ) : isReportsView ? (
            <section className="pm-reports" aria-label="Báo cáo">
              {(() => {
                const reportLabels: Record<string, { title: string; desc: string; icon: string }> = {
                  eisenhower: { title: "Phân loại theo Eisenhower", desc: "Phân loại công việc theo ma trận Eisenhower (quan trọng – khẩn cấp).", icon: "🎯" },
                  "slcv-thoi-gian": { title: "Số lượng công việc theo thời gian", desc: "Thống kê số lượng công việc được tạo, hoàn thành và đang thực hiện theo từng mốc thời gian.", icon: "📅" },
                  "slcv-nguoi-thuc-hien": { title: "Số lượng công việc theo người thực hiện", desc: "Phân tích phân bổ công việc theo từng thành viên thực hiện.", icon: "👤" },
                  "slcv-nguoi-lien-quan": { title: "Số lượng công việc theo người liên quan", desc: "Thống kê công việc theo từng người liên quan.", icon: "👥" },
                  "thoi-gian-thuc-hien": { title: "Thời gian thực hiện công việc", desc: "Phân tích thời gian trung bình và thực tế để hoàn thành từng loại công việc.", icon: "⏱️" },
                  "phan-bo-nguon-luc": { title: "Phân bổ nguồn lực", desc: "Xem mức độ sử dụng nhân lực và phân bổ tài nguyên trong các dự án.", icon: "📊" },
                  "tinh-trang-thuc-hien": { title: "Tình trạng thực hiện công việc", desc: "Báo cáo tổng quan về trạng thái công việc: chưa làm, đang làm, hoàn thành.", icon: "📋" },
                  "giao-cho-toi": { title: "Việc giao cho tôi", desc: "Danh sách và thống kê các công việc được giao cho bạn.", icon: "📌" },
                  "lui-han": { title: "Tình hình lùi hạn công việc", desc: "Theo dõi các công việc bị trễ hạn và mức độ lùi hạn.", icon: "⚠️" },
                  "trien-khai-da": { title: "Tình hình triển khai dự án", desc: "Tổng quan về tiến độ và tình trạng triển khai các dự án.", icon: "🚀" },
                  gantt: { title: "Sơ đồ Gantt", desc: "Biểu đồ Gantt hiển thị tiến độ công việc và dự án theo trục thời gian.", icon: "📉" },
                  "hoat-dong-da": { title: "Tình hình hoạt động dự án", desc: "Lịch sử và thống kê các hoạt động diễn ra trong dự án.", icon: "📈" },
                  "toi-tao": { title: "Tôi tạo", desc: "Danh sách và thống kê các báo cáo do bạn tạo.", icon: "✏️" },
                  "chia-se-voi-toi": { title: "Báo cáo chia sẻ với tôi", desc: "Các báo cáo mà người khác đã chia sẻ với bạn.", icon: "🤝" },
                };
                if (!currentReport) {
                  return (
                    <div className="pm-report-overview">
                      <div className="pm-report-overview-icon">📊</div>
                      <h2 className="pm-report-overview-title">Báo cáo</h2>
                      <p className="pm-report-overview-desc">
                        Chọn một loại báo cáo từ menu bên trái để xem thống kê và phân tích công việc.
                      </p>
                      <div className="pm-report-overview-grid">
                        {Object.entries(reportLabels).slice(0, 6).map(([key, info]) => (
                          <Link key={key} href={`/home?view=reports&report=${key}`} className="pm-report-overview-card">
                            <span className="pm-report-overview-card-icon">{info.icon}</span>
                            <span className="pm-report-overview-card-title">{info.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                }
                const info = reportLabels[currentReport];

                // Eisenhower Matrix — full custom page
                if (currentReport === "eisenhower") {
                  return (
                    <div className="pm-report-view pm-report-eisenhower">
                      <div className="pm-report-view-header">
                        <span className="pm-report-view-icon">{info?.icon ?? "🎯"}</span>
                        <div>
                          <h2 className="pm-report-view-title">{info?.title ?? "Phân loại theo Eisenhower"}</h2>
                          {info?.desc ? <p className="pm-report-view-desc">{info.desc}</p> : null}
                        </div>
                      </div>
                      <div className="pm-report-view-body pm-report-view-body-full">
                        <EisenhowerMatrixClient />
                      </div>
                    </div>
                  );
                }

                // Tasks Over Time — full custom page
                if (currentReport === "slcv-thoi-gian") {
                  return (
                    <div className="pm-report-view pm-report-chart-full">
                      <div className="pm-report-view-header">
                        <span className="pm-report-view-icon">{info?.icon ?? "📅"}</span>
                        <div>
                          <h2 className="pm-report-view-title">{info?.title ?? "Số lượng CV theo thời gian"}</h2>
                          {info?.desc ? <p className="pm-report-view-desc">{info.desc}</p> : null}
                        </div>
                      </div>
                      <div className="pm-report-view-body pm-report-view-body-full">
                        <TasksOverTimeClient />
                      </div>
                    </div>
                  );
                }

                // Tasks By Assignee — full custom page
                if (currentReport === "slcv-nguoi-thuc-hien") {
                  return (
                    <div className="pm-report-view pm-report-chart-full">
                      <div className="pm-report-view-header">
                        <span className="pm-report-view-icon">{info?.icon ?? "👥"}</span>
                        <div>
                          <h2 className="pm-report-view-title">{info?.title ?? "Số lượng CV theo người thực hiện"}</h2>
                          {info?.desc ? <p className="pm-report-view-desc">{info.desc}</p> : null}
                        </div>
                      </div>
                      <div className="pm-report-view-body pm-report-view-body-full">
                        <TasksByAssigneeClient />
                      </div>
                    </div>
                  );
                }

                // Tasks By Related Person — full custom page
                if (currentReport === "slcv-nguoi-lien-quan") {
                  return (
                    <div className="pm-report-view pm-report-chart-full">
                      <div className="pm-report-view-header">
                        <span className="pm-report-view-icon">{info?.icon ?? "👥"}</span>
                        <div>
                          <h2 className="pm-report-view-title">{info?.title ?? "Số lượng CV theo người liên quan"}</h2>
                          {info?.desc ? <p className="pm-report-view-desc">{info.desc}</p> : null}
                        </div>
                      </div>
                      <div className="pm-report-view-body pm-report-view-body-full">
                        <TasksByRelatedClient />
                      </div>
                    </div>
                  );
                }

                // Task Duration — full custom page
                if (currentReport === "thoi-gian-thuc-hien") {
                  return (
                    <div className="pm-report-view pm-report-chart-full">
                      <div className="pm-report-view-header">
                        <span className="pm-report-view-icon">{info?.icon ?? "⏱️"}</span>
                        <div>
                          <h2 className="pm-report-view-title">{info?.title ?? "Thời gian thực hiện công việc"}</h2>
                          {info?.desc ? <p className="pm-report-view-desc">{info.desc}</p> : null}
                        </div>
                      </div>
                      <div className="pm-report-view-body pm-report-view-body-full">
                        <TaskDurationClient />
                      </div>
                    </div>
                  );
                }

                // Resource Allocation — full custom page
                if (currentReport === "phan-bo-nguon-luc") {
                  return (
                    <div className="pm-report-view pm-report-chart-full">
                      <div className="pm-report-view-header">
                        <span className="pm-report-view-icon">{info?.icon ?? "🎯"}</span>
                        <div>
                          <h2 className="pm-report-view-title">{info?.title ?? "Phân bổ nguồn lực"}</h2>
                          {info?.desc ? <p className="pm-report-view-desc">{info.desc}</p> : null}
                        </div>
                      </div>
                      <div className="pm-report-view-body pm-report-view-body-full">
                        <ResourceAllocationClient />
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="pm-report-view">
                    <div className="pm-report-view-header">
                      <span className="pm-report-view-icon">{info?.icon ?? "📊"}</span>
                      <div>
                        <h2 className="pm-report-view-title">{info?.title ?? currentReport}</h2>
                        {info?.desc ? <p className="pm-report-view-desc">{info.desc}</p> : null}
                      </div>
                    </div>
                    <div className="pm-report-view-body">
                      <div className="pm-report-wip">
                        <span className="pm-report-wip-icon">🔧</span>
                        <p className="pm-report-wip-text">Báo cáo này đang được phát triển. Vui lòng quay lại sau.</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>
          ) : isAnalyticsView ? (
            <section className="pm-analytics" aria-label="Phân tích công việc">
              <AnalyticsDashboardClient />
            </section>
          ) : isTrashView ? (
            <>
              {deletedTaskResult?.error ? (
                <p className="pm-profile-error">{deletedTaskResult.error}</p>
              ) : (
                <TrashTasksClient initialTasks={deletedTaskResult?.tasks || []} />
              )}
              {deletedProjectResult?.error ? (
                <p className="pm-profile-error">{deletedProjectResult.error}</p>
              ) : (
                <TrashProjectsClient initialProjects={deletedProjectResult?.projects || []} />
              )}
            </>
          ) : (
            <div className="pm-empty-workspace" aria-hidden="true" />
          )}
        </section>
      </div>
    </div>
  );
}
