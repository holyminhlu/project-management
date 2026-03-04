import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { verifyJwtHs256 } from "../../lib/jwt";
import AvatarMenu from "./AvatarMenu";

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
      }
    | Promise<{
        view?: string | string[];
        sort?: string | string[];
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
  han_hoan_thanh: string | null;
  ten_du_an: string | null;
  status_key: TaskStatusKey;
};

type PersonalTasksResponse = {
  tasks?: PersonalTask[];
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
  const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";

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
  const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";

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

function formatDueDate(dateValue: string | null) {
  if (!dateValue) return "Chưa có hạn";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Chưa có hạn";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("pm_access")?.value;
  const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-secret";
  const viewParam = resolvedSearchParams?.view;
  const sortParam = resolvedSearchParams?.sort;
  const currentView = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  const currentSort = Array.isArray(sortParam) ? sortParam[0] : sortParam;
  const isProfileView = currentView === "profile";
  const isPersonalTasksView = currentView === "personal-tasks";
  const isSortEnabled = currentSort === "due_asc";

  // Note: middleware already protects /home; this is only for display.
  // If verification fails, we fall back to "U".
  const payload = accessToken ? await verifyJwtHs256(accessToken, accessSecret) : null;
  const displayName = typeof payload?.ten_nv === "string" ? payload.ten_nv : "";
  const initials = toInitials(displayName);
  const profile = isProfileView && accessToken ? await getProfile(accessToken) : null;
  const personalTasks = isPersonalTasksView && accessToken ? await getPersonalTasks(accessToken) : null;
  const taskList = (personalTasks?.tasks || []).slice().sort((a, b) => {
    if (!isSortEnabled) return 0;
    const aTime = a.han_hoan_thanh ? new Date(a.han_hoan_thanh).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.han_hoan_thanh ? new Date(b.han_hoan_thanh).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
  const todoTasks = taskList.filter((task) => task.status_key === "todo");
  const inProgressTasks = taskList.filter((task) => task.status_key === "in_progress");
  const doneTasks = taskList.filter((task) => task.status_key === "done");

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
          <div className="trash-sub">
            <span style={{ fontSize: 13 }}>🔄</span> Công việc đã xóa
          </div>
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
                  href={isSortEnabled ? "/home?view=personal-tasks" : "/home?view=personal-tasks&sort=due_asc"}
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
                <Link className="pm-tool-refresh" href="/home?view=personal-tasks">
                  <Image className="pm-tool-icon-image" src="/icon/refresh.png" alt="Refresh" width={14} height={14} />
                  Làm mới
                </Link>
              </div>

              {personalTasks?.error ? <p className="pm-profile-error">{personalTasks.error}</p> : null}

              <div className="pm-task-board">
                <section className="pm-task-column">
                  <header className="pm-task-col-header">
                    <h3>Cần thực hiện</h3>
                    <span>{todoTasks.length}</span>
                  </header>
                  <div className="pm-task-list">
                    {todoTasks.length === 0 ? (
                      <p className="pm-task-empty">Chưa có công việc.</p>
                    ) : (
                      todoTasks.map((task) => (
                        <article key={task.ma_cong_viec} className="pm-task-card">
                          <h4>{task.tieu_de}</h4>
                          <p>Mã: {task.ma_cong_viec}</p>
                          <p>Dự án: {task.ten_du_an || "Chưa có"}</p>
                          <p>Hạn: {formatDueDate(task.han_hoan_thanh)}</p>
                        </article>
                      ))
                    )}
                  </div>
                </section>

                <section className="pm-task-column">
                  <header className="pm-task-col-header">
                    <h3>Đang thực hiện</h3>
                    <span>{inProgressTasks.length}</span>
                  </header>
                  <div className="pm-task-list">
                    {inProgressTasks.length === 0 ? (
                      <p className="pm-task-empty">Chưa có công việc.</p>
                    ) : (
                      inProgressTasks.map((task) => (
                        <article key={task.ma_cong_viec} className="pm-task-card">
                          <h4>{task.tieu_de}</h4>
                          <p>Mã: {task.ma_cong_viec}</p>
                          <p>Dự án: {task.ten_du_an || "Chưa có"}</p>
                          <p>Hạn: {formatDueDate(task.han_hoan_thanh)}</p>
                        </article>
                      ))
                    )}
                  </div>
                </section>

                <section className="pm-task-column">
                  <header className="pm-task-col-header">
                    <h3>Đã hoàn thành</h3>
                    <span>{doneTasks.length}</span>
                  </header>
                  <div className="pm-task-list">
                    {doneTasks.length === 0 ? (
                      <p className="pm-task-empty">Chưa có công việc.</p>
                    ) : (
                      doneTasks.map((task) => (
                        <article key={task.ma_cong_viec} className="pm-task-card">
                          <h4>{task.tieu_de}</h4>
                          <p>Mã: {task.ma_cong_viec}</p>
                          <p>Dự án: {task.ten_du_an || "Chưa có"}</p>
                          <p>Hạn: {formatDueDate(task.han_hoan_thanh)}</p>
                        </article>
                      ))
                    )}
                  </div>
                </section>

                <section className="pm-task-column pm-task-column-add">
                  <button className="pm-task-add-btn" type="button">+ Thêm nhóm công việc</button>
                </section>
              </div>
            </section>
          ) : (
            <div className="pm-empty-workspace" aria-hidden="true" />
          )}
        </section>
      </div>
    </div>
  );
}
