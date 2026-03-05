import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import AvatarMenu from "./AvatarMenu";
import ProjectPickerClient from "./ProjectPickerClient";
import TaskColumnsClient from "./TaskColumnsClient";
import TrashTasksClient from "./TrashTasksClient";
import TrashProjectsClient from "./TrashProjectsClient";

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
  }
  | Promise<{
    view?: string | string[];
    sort?: string | string[];
    project?: string | string[];
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
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";

  try {
    const response = await fetch(`${backendUrl}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as MeResponse;
    if (!response.ok || !data.user) {
      return { error: data.error || "Không thể tải thông tin cá nhân." };
    }
    return { user: data.user };
  } catch {
    return { error: "Không thể kết nối máy chủ để tải thông tin cá nhân." };
  }
}

async function getPersonalTasks(accessToken: string): Promise<PersonalTasksResponse> {
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";

  try {
    const response = await fetch(`${backendUrl}/tasks/personal`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as PersonalTasksResponse;
    if (!response.ok || !Array.isArray(data.tasks)) {
      return { error: data.error || "Không thể tải công việc cá nhân." };
    }
    return { tasks: data.tasks };
  } catch {
    return { error: "Không thể kết nối máy chủ để tải công việc cá nhân." };
  }
}

async function getPersonalProjects(accessToken: string): Promise<PersonalProjectsResponse> {
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";

  try {
    const response = await fetch(`${backendUrl}/projects/personal`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as PersonalProjectsResponse;
    if (!response.ok || !Array.isArray(data.projects)) {
      return { error: data.error || "KhÃ´ng thá»ƒ táº£i dá»± Ã¡n cÃ¡ nhÃ¢n." };
    }
    return { projects: data.projects };
  } catch {
    return { error: "KhÃ´ng thá»ƒ káº¿t ná»‘i mÃ¡y chá»§ Ä‘á»ƒ táº£i dá»± Ã¡n cÃ¡ nhÃ¢n." };
  }
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
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";

  try {
    const response = await fetch(`${backendUrl}/projects/personal/${encodeURIComponent(projectId)}/members`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as ProjectMembersResponse;
    if (!response.ok || !Array.isArray(data.members)) {
      return { error: data.error || "Không thể tải thành viên dự án." };
    }
    return { members: data.members };
  } catch {
    return { error: "Không thể kết nối máy chủ để tải thành viên dự án." };
  }
}

async function getDeletedTasks(accessToken: string): Promise<DeletedTasksResponse> {
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";

  try {
    const response = await fetch(`${backendUrl}/tasks/personal/deleted`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as DeletedTasksResponse;
    if (!response.ok || !Array.isArray(data.tasks)) {
      return { error: data.error || "Không thể tải công việc đã xóa." };
    }
    return { tasks: data.tasks };
  } catch {
    return { error: "Không thể kết nối máy chủ để tải công việc đã xóa." };
  }
}

async function getDeletedProjects(accessToken: string): Promise<DeletedProjectsResponse> {
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";

  try {
    const response = await fetch(`${backendUrl}/projects/personal/deleted`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as DeletedProjectsResponse;
    if (!response.ok || !Array.isArray(data.projects)) {
      return { error: data.error || "Không thể tải dự án đã xóa." };
    }
    return { projects: data.projects };
  } catch {
    return { error: "Không thể kết nối máy chủ để tải dự án đã xóa." };
  }
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
          <div className="nav-item">
            <span className="nav-icon">
              <Image className="sidebar-icon-image" src="/icon/chart.png" alt="Chart" width={16} height={16} />
            </span>{" "}
            Báo cáo
          </div>

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

                  <ProjectPickerClient initialProjects={personalProjects} />
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

                  <div className="pm-task-tools">
                    <label className="pm-tool-search-wrap">
                      <Image className="pm-tool-icon-image" src="/icon/search.png" alt="Search" width={14} height={14} />
                      <input className="pm-tool-search" type="text" placeholder="Tìm kiếm..." />
                    </label>
                    <button className="pm-tool-icon-btn" type="button" aria-label="Bộ lọc">
                      <Image className="pm-tool-icon-image" src="/icon/filter.png" alt="Filter" width={14} height={14} />
                    </button>
                    <div className="pm-tool-select-wrap">
                      <select className="pm-tool-select" defaultValue="all">
                        <option value="all">Bộ lọc trạng thái công việc</option>
                        <option value="todo">Cần thực hiện</option>
                        <option value="in_progress">Đang thực hiện</option>
                        <option value="done">Đã hoàn thành</option>
                      </select>
                    </div>
                    <button className="pm-tool-btn" type="button">
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
                    <button className="pm-tool-btn" type="button">
                      <Image className="pm-tool-icon-image" src="/icon/show.png" alt="Show" width={14} height={14} />
                      Tùy chỉnh hiển thị
                    </button>
                    <button className="pm-tool-btn" type="button">
                      <Image className="pm-tool-icon-image" src="/icon/export.png" alt="Export" width={14} height={14} />
                      Xuất khẩu
                    </button>
                    <button className="pm-tool-btn" type="button">
                      <Image className="pm-tool-icon-image" src="/icon/chart.png" alt="Analyze" width={14} height={14} />
                      Phân tích công việc
                    </button>
                    <Link className="pm-tool-refresh" href={`/home?view=personal-tasks&project=${encodeURIComponent(selectedProjectId)}`}>
                      <Image className="pm-tool-icon-image" src="/icon/refresh.png" alt="Refresh" width={14} height={14} />
                      Làm mới
                    </Link>
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
