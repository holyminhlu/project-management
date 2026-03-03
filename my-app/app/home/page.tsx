import Image from "next/image";
import type { Metadata } from "next";

type HeaderIcon = {
  title: string;
  src: string;
  alt: string;
  showBadge?: boolean;
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

export default function HomePage() {
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

          <div className="nav-group-label">
            <span style={{ fontSize: 12 }}>▾</span> Cá nhân
          </div>
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
            <div className="avatar">Uh</div>
          </div>
        </header>
      </div>
    </div>
  );
}
