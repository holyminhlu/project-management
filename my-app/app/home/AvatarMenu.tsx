"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initials: string;
  displayName?: string;
};

export default function AvatarMenu({ initials, displayName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const buttonLabel = useMemo(() => {
    const fallback = initials || "U";
    return fallback.toUpperCase();
  }, [initials]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      localStorage.removeItem("pm_access_token");
      setOpen(false);
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="pm-avatar">
      <button
        className="pm-avatar-btn"
        type="button"
        title={displayName ? `Xin chào, ${displayName}` : "Tài khoản"}
        onClick={() => setOpen((value) => !value)}
      >
        {buttonLabel}
      </button>

      {open ? (
        <div className="pm-avatar-menu">
          <button
            className="pm-avatar-item"
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/home?view=profile");
            }}
          >
            Thông tin cá nhân
          </button>

          <button
            className="pm-avatar-logout"
            type="button"
            onClick={() => void logout()}
          >
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  );
}
