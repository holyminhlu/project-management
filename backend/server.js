const express = require("express");
const cors = require("cors");
require("dotenv").config();
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());

const { poolPromise, sql } = require("./config/db");

const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 60 * 15);
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7);

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-secret";
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "change-this-secret";
const JWT_ISSUER = process.env.JWT_ISSUER || "pm-backend";

function normalizeStatus(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[\s_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isInactiveStatus(value) {
  if (value === null || value === undefined) return false;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return false;

  // Defensive: some setups store Vietnamese text in VARCHAR and it may come back as
  // "Ho?t d?ng" / "T?m ngh?". In that case, normalized string becomes unreliable.
  // We therefore treat status as INACTIVE only when it clearly indicates inactive.
  const normalized = normalizeStatus(raw);

  if (["0", "false", "inactive", "disabled"].includes(normalized)) return true;
  if (normalized.includes("tam") && normalized.includes("nghi")) return true;
  if (normalized.includes("khong") && normalized.includes("hoat")) return true;

  // Fallback heuristics for corrupted text (e.g., "t?m ngh?")
  if (raw.includes("ngh")) return true;

  return false;
}

function mapTaskStatusKey(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  const normalized = normalizeStatus(raw);

  if (normalized.includes("da_xoa") || normalized.includes("deleted") || normalized.includes("xoa")) {
    return "deleted";
  }

  if (
    normalized.includes("hoan_thanh") ||
    normalized.includes("completed") ||
    normalized.includes("done")
  ) {
    return "done";
  }
  if (
    normalized.includes("dang_thuc_hien") ||
    normalized.includes("in_progress") ||
    normalized.includes("doing")
  ) {
    return "in_progress";
  }
  return "todo";
}

function isDeletedStatus(value) {
  return mapTaskStatusKey(value) === "deleted";
}

function statusKeyToDbValue(statusKey) {
  if (statusKey === "deleted") return "Đã xóa";
  if (statusKey === "done") return "Đã hoàn thành";
  if (statusKey === "in_progress") return "Đang thực hiện";
  return "Cần thực hiện";
}

function parseRequestedStatusKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = normalizeStatus(raw);

  if (normalized === "todo" || normalized.includes("can_thuc_hien") || normalized.includes("to_do")) {
    return "todo";
  }
  if (normalized === "in_progress" || normalized.includes("dang_thuc_hien") || normalized.includes("doing")) {
    return "in_progress";
  }
  if (normalized === "done" || normalized.includes("hoan_thanh") || normalized.includes("completed")) {
    return "done";
  }
  if (normalized === "deleted" || normalized.includes("da_xoa") || normalized.includes("xoa")) {
    return "deleted";
  }
  return null;
}
function toIsoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function generateTaskCode(pool) {
  const maxResult = await pool.request().query(
    `SELECT
        ISNULL(MAX(TRY_CONVERT(INT, SUBSTRING(ma_cong_viec, 3, LEN(ma_cong_viec) - 2))), 0) AS max_index
     FROM dbo.cong_viec
     WHERE ma_cong_viec LIKE 'CV[0-9]%'`,
  );

  let nextIndex = Number(maxResult.recordset[0]?.max_index || 0) + 1;

  // Defensive: increment until finding an unused code.
  for (let i = 0; i < 20; i += 1) {
    const code = `CV${nextIndex}`;
    const exists = await pool.request().input("ma_cong_viec", sql.VarChar(25), code).query(
      `SELECT TOP 1 ma_cong_viec
       FROM dbo.cong_viec
       WHERE ma_cong_viec = @ma_cong_viec`,
    );
    if (!exists.recordset[0]) return code;
    nextIndex += 1;
  }

  throw new Error("Không thể tạo mã công việc theo thứ tự.");
}

async function generateProjectCode(pool) {
  const maxResult = await pool.request().query(
    `SELECT
        ISNULL(MAX(TRY_CONVERT(INT, SUBSTRING(ma_du_an, 3, LEN(ma_du_an) - 2))), 0) AS max_index
     FROM dbo.du_an
     WHERE ma_du_an LIKE 'DA[0-9]%'`,
  );

  let nextIndex = Number(maxResult.recordset[0]?.max_index || 0) + 1;

  for (let i = 0; i < 30; i += 1) {
    const code = `DA${nextIndex}`;
    const exists = await pool.request().input("ma_du_an", sql.VarChar(25), code).query(
      `SELECT TOP 1 ma_du_an
       FROM dbo.du_an
       WHERE ma_du_an = @ma_du_an`,
    );
    if (!exists.recordset[0]) return code;
    nextIndex += 1;
  }

  throw new Error("Không thể tạo mã dự án theo thứ tự.");
}

async function tableExists(pool, tableName) {
  const result = await pool
    .request()
    .input("table_name", sql.VarChar(128), tableName)
    .query(
      `SELECT CASE WHEN OBJECT_ID('dbo.' + @table_name, 'U') IS NOT NULL THEN 1 ELSE 0 END AS is_exists`,
    );
  return Number(result.recordset[0]?.is_exists || 0) === 1;
}

async function getDuAnColumns(pool) {
  const result = await pool.request().query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'du_an'`,
  );
  return new Set(result.recordset.map((row) => String(row.COLUMN_NAME || "").trim().toLowerCase()));
}

function sha256Buffer(input) {
  return crypto.createHash("sha256").update(input).digest();
}

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.ma_nhan_vien,
      type: "access",
    },
    ACCESS_TOKEN_SECRET,
    {
      algorithm: "HS256",
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      issuer: JWT_ISSUER,
    },
  );
}

function createRefreshToken(user, tokenId) {
  return jwt.sign(
    {
      sub: user.ma_nhan_vien,
      type: "refresh",
      tokenId,
    },
    REFRESH_TOKEN_SECRET,
    {
      algorithm: "HS256",
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      issuer: JWT_ISSUER,
    },
  );
}

async function ensureAuthTables(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.auth_refresh_tokens', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.auth_refresh_tokens (
        token_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ma_nhan_vien VARCHAR(25) NOT NULL,
        token_hash VARBINARY(32) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        expires_at DATETIME2 NOT NULL,
        revoked_at DATETIME2 NULL,
        replaced_by UNIQUEIDENTIFIER NULL
      );

      CREATE INDEX IX_auth_refresh_tokens_user ON dbo.auth_refresh_tokens (ma_nhan_vien);
    END
  `);
}

async function ensureTaskTrashTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.task_trash_logs', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.task_trash_logs (
        ma_cong_viec VARCHAR(25) NOT NULL PRIMARY KEY,
        deleted_by VARCHAR(25) NOT NULL,
        deleted_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );

      CREATE INDEX IX_task_trash_logs_deleted_by ON dbo.task_trash_logs (deleted_by);
    END
  `);
}

async function insertRefreshToken(pool, { tokenId, ma_nhan_vien, refreshToken, expiresAt }) {
  const tokenHash = sha256Buffer(refreshToken);
  await pool
    .request()
    .input("token_id", sql.UniqueIdentifier, tokenId)
    .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
    .input("token_hash", sql.VarBinary(32), tokenHash)
    .input("expires_at", sql.DateTime2, expiresAt)
    .query(
      `INSERT INTO dbo.auth_refresh_tokens (token_id, ma_nhan_vien, token_hash, expires_at)
       VALUES (@token_id, @ma_nhan_vien, @token_hash, @expires_at)`,
    );
}

async function revokeRefreshToken(pool, { tokenId, replacedBy }) {
  await pool
    .request()
    .input("token_id", sql.UniqueIdentifier, tokenId)
    .input("replaced_by", sql.UniqueIdentifier, replacedBy)
    .query(
      `UPDATE dbo.auth_refresh_tokens
       SET revoked_at = SYSUTCDATETIME(), replaced_by = @replaced_by
       WHERE token_id = @token_id AND revoked_at IS NULL`,
    );
}

async function revokeRefreshTokenWithoutReplacement(pool, { tokenId }) {
  await pool
    .request()
    .input("token_id", sql.UniqueIdentifier, tokenId)
    .query(
      `UPDATE dbo.auth_refresh_tokens
       SET revoked_at = SYSUTCDATETIME(), replaced_by = NULL
       WHERE token_id = @token_id AND revoked_at IS NULL`,
    );
}

async function revokeAllActiveRefreshTokensForUser(pool, { ma_nhan_vien }) {
  await pool
    .request()
    .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
    .query(
      `UPDATE dbo.auth_refresh_tokens
       SET revoked_at = SYSUTCDATETIME(), replaced_by = NULL
       WHERE ma_nhan_vien = @ma_nhan_vien
         AND revoked_at IS NULL
         AND expires_at > SYSUTCDATETIME()`,
    );
}

function getBearerToken(req) {
  const raw = req.headers?.authorization;
  if (raw) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    const match = String(value).match(/^Bearer\s+(.+)$/i);
    if (match) return match[1];
  }

  // Fallback: allow access token from cookie for browser requests.
  const cookieHeader = req.headers?.cookie;
  const cookieValue = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  if (!cookieValue) return null;

  const cookies = String(cookieValue)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const entry of cookies) {
    const [key, ...rest] = entry.split("=");
    if (key === "pm_access") {
      const value = rest.join("=");
      return decodeURIComponent(value || "");
    }
  }
  return null;
}

function verifyAccessToken(accessToken) {
  const decoded = jwt.verify(accessToken, ACCESS_TOKEN_SECRET, {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
  });
  if (!decoded || decoded.type !== "access" || !decoded.sub) {
    return null;
  }
  return decoded;
}

async function getRefreshTokenRow(pool, { tokenId, ma_nhan_vien }) {
  const result = await pool
    .request()
    .input("token_id", sql.UniqueIdentifier, tokenId)
    .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
    .query(
      `SELECT token_hash, expires_at, revoked_at
       FROM dbo.auth_refresh_tokens
       WHERE token_id = @token_id AND ma_nhan_vien = @ma_nhan_vien`,
    );

  return result.recordset[0] || null;
}

async function getEmployeeByEmail(pool, email) {
  const result = await pool
    .request()
    .input("email", sql.VarChar(100), email)
    .query(
      `SELECT TOP 1 ma_nhan_vien, ten_nv, email, password, trang_thai_hoat_dong
       FROM dbo.nhan_vien
       WHERE email = @email`,
    );
  return result.recordset[0] || null;
}

app.get("/health", async (_req, res) => {
  res.json({ ok: true });
});

app.get("/users", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT TOP 100 * FROM dbo.nhan_vien");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Vui lòng nhập email và mật khẩu." });
    }

    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const employee = await getEmployeeByEmail(pool, email);
    if (!employee) {
      return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không đúng." });
    }

    if (String(employee.password || "") !== password) {
      return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không đúng." });
    }

    if (isInactiveStatus(employee.trang_thai_hoat_dong)) {
      return res.status(403).json({ error: "Tài khoản hiện không hoạt động." });
    }

    const user = {
      ma_nhan_vien: employee.ma_nhan_vien,
      ten_nv: employee.ten_nv,
      email: employee.email,
    };

    const accessToken = createAccessToken(user);
    const refreshTokenId = crypto.randomUUID();
    const refreshToken = createRefreshToken(user, refreshTokenId);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    await insertRefreshToken(pool, {
      tokenId: refreshTokenId,
      ma_nhan_vien: user.ma_nhan_vien,
      refreshToken,
      expiresAt: refreshExpiresAt,
    });

    return res.json({
      message: "Đăng nhập thành công.",
      user,
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi đăng nhập." });
  }
});

app.post("/auth/refresh", async (req, res) => {
  try {
    const refreshToken = String(req.body?.refreshToken || "");
    if (!refreshToken) {
      return res.status(400).json({ error: "Thiếu refresh token." });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, {
        algorithms: ["HS256"],
        issuer: JWT_ISSUER,
      });
    } catch {
      return res.status(401).json({ error: "Refresh token không hợp lệ." });
    }

    if (!decoded || decoded.type !== "refresh" || !decoded.sub || !decoded.tokenId) {
      return res.status(401).json({ error: "Refresh token không hợp lệ." });
    }

    const ma_nhan_vien = String(decoded.sub);
    const tokenId = String(decoded.tokenId);
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const row = await getRefreshTokenRow(pool, { tokenId, ma_nhan_vien });
    if (!row) {
      return res.status(401).json({ error: "Refresh token không tồn tại." });
    }
    if (row.revoked_at) {
      // Refresh token reuse detected -> revoke all active sessions of this user.
      await revokeAllActiveRefreshTokensForUser(pool, { ma_nhan_vien });
      return res.status(401).json({ error: "Refresh token đã bị thu hồi." });
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return res.status(401).json({ error: "Refresh token đã hết hạn." });
    }

    const incomingHash = sha256Buffer(refreshToken);
    const storedHash = row.token_hash;
    if (!storedHash || !Buffer.isBuffer(storedHash) || storedHash.length !== incomingHash.length) {
      await revokeAllActiveRefreshTokensForUser(pool, { ma_nhan_vien });
      return res.status(401).json({ error: "Refresh token không hợp lệ." });
    }
    if (!crypto.timingSafeEqual(storedHash, incomingHash)) {
      await revokeAllActiveRefreshTokensForUser(pool, { ma_nhan_vien });
      return res.status(401).json({ error: "Refresh token không hợp lệ." });
    }

    const employeeResult = await pool
      .request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT TOP 1 ma_nhan_vien, ten_nv, email, trang_thai_hoat_dong
         FROM dbo.nhan_vien
         WHERE ma_nhan_vien = @ma_nhan_vien`,
      );
    const employee = employeeResult.recordset[0];
    if (!employee) {
      return res.status(401).json({ error: "Người dùng không tồn tại." });
    }
    if (isInactiveStatus(employee.trang_thai_hoat_dong)) {
      return res.status(403).json({ error: "Tài khoản hiện không hoạt động." });
    }

    const user = {
      ma_nhan_vien: employee.ma_nhan_vien,
      ten_nv: employee.ten_nv,
      email: employee.email,
    };

    const newAccessToken = createAccessToken(user);
    const newRefreshTokenId = crypto.randomUUID();
    const newRefreshToken = createRefreshToken(user, newRefreshTokenId);
    const newRefreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    await insertRefreshToken(pool, {
      tokenId: newRefreshTokenId,
      ma_nhan_vien: user.ma_nhan_vien,
      refreshToken: newRefreshToken,
      expiresAt: newRefreshExpiresAt,
    });
    await revokeRefreshToken(pool, { tokenId, replacedBy: newRefreshTokenId });

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi refresh token." });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

app.get("/auth/me", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Thiếu access token." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    if (!decoded) {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    const ma_nhan_vien = String(decoded.sub);
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT TOP 1
            nv.ma_nhan_vien,
            nv.ten_nv,
            nv.email,
            nv.ma_vai_tro,
            vt.ten_vai_tro,
            nv.ma_phong_ban,
            pb.ten_phong_ban,
            nv.trang_thai_hoat_dong,
            nv.ngay_tao_nhan_vien
         FROM dbo.nhan_vien nv
         LEFT JOIN dbo.vai_tro vt ON vt.ma_vai_tro = nv.ma_vai_tro
         LEFT JOIN dbo.phong_ban pb ON pb.ma_phong_ban = nv.ma_phong_ban
         WHERE nv.ma_nhan_vien = @ma_nhan_vien`,
      );

    const employee = result.recordset[0];
    if (!employee) {
      return res.status(404).json({ error: "Không tìm thấy nhân viên." });
    }
    if (isInactiveStatus(employee.trang_thai_hoat_dong)) {
      return res.status(403).json({ error: "Tài khoản hiện không hoạt động." });
    }

    return res.json({
      user: {
        ma_nhan_vien: employee.ma_nhan_vien,
        ten_nv: employee.ten_nv,
        email: employee.email,
        ma_vai_tro: employee.ma_vai_tro,
        ten_vai_tro: employee.ten_vai_tro,
        ma_phong_ban: employee.ma_phong_ban,
        ten_phong_ban: employee.ten_phong_ban,
        ngay_tao_nhan_vien: employee.ngay_tao_nhan_vien,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi lấy thông tin cá nhân." });
  }
});

app.get("/projects/personal", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Thiếu access token." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    if (!decoded) {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    const ma_nhan_vien = String(decoded.sub);
    const pool = await poolPromise;
    const hasThanhVienNhom = await tableExists(pool, "thanh_vien_nhom");
    const duAnCols = await getDuAnColumns(pool);
    const hasTrangThaiDuAn = duAnCols.has("trang_thai_du_an");
    const deletedFilter = hasTrangThaiDuAn
      ? " AND (da.trang_thai_du_an IS NULL OR da.trang_thai_du_an <> N'Đã bị gỡ')"
      : "";
    const query = hasThanhVienNhom
      ? `SELECT
           da.ma_du_an,
           da.ten_du_an,
           da.ma_phong_ban,
           COUNT(DISTINCT cv.ma_cong_viec) AS so_luong_cong_viec
         FROM dbo.du_an da
         LEFT JOIN dbo.cong_viec cv ON cv.ma_du_an = da.ma_du_an
         LEFT JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
         LEFT JOIN dbo.thanh_vien_nhom tvn ON tvn.ma_nhom = da.ma_nhom
         WHERE (pt.ma_nhan_vien = @ma_nhan_vien OR tvn.ma_nhan_vien = @ma_nhan_vien)${deletedFilter}
         GROUP BY da.ma_du_an, da.ten_du_an, da.ma_phong_ban
         ORDER BY da.ten_du_an ASC`
      : `SELECT
           da.ma_du_an,
           da.ten_du_an,
           da.ma_phong_ban,
           COUNT(DISTINCT cv.ma_cong_viec) AS so_luong_cong_viec
         FROM dbo.phu_trach pt
         INNER JOIN dbo.cong_viec cv ON cv.ma_cong_viec = pt.ma_cong_viec
         INNER JOIN dbo.du_an da ON da.ma_du_an = cv.ma_du_an
         WHERE pt.ma_nhan_vien = @ma_nhan_vien${deletedFilter}
         GROUP BY da.ma_du_an, da.ten_du_an, da.ma_phong_ban
         ORDER BY da.ten_du_an ASC`;

    const result = await pool.request().input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien).query(query);

    return res.json({ projects: result.recordset });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi lấy dự án cá nhân." });
  }
});

// ── Soft-delete project (set trang_thai_du_an = 'Đã bị gỡ') ──
app.patch("/projects/personal/:ma_du_an", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Thiếu access token." });
    let decoded;
    try { decoded = verifyAccessToken(token); } catch { return res.status(401).json({ error: "Access token không hợp lệ." }); }
    if (!decoded) return res.status(401).json({ error: "Access token không hợp lệ." });

    const ma_du_an = String(req.params.ma_du_an || "").trim();
    if (!ma_du_an) return res.status(400).json({ error: "Thiếu mã dự án." });

    const pool = await poolPromise;
    const duAnCols = await getDuAnColumns(pool);
    if (!duAnCols.has("trang_thai_du_an")) {
      return res.status(400).json({ error: "Bảng du_an chưa có cột trang_thai_du_an." });
    }

    const result = await pool.request()
      .input("ma_du_an", sql.VarChar(25), ma_du_an)
      .input("trang_thai_du_an", sql.NVarChar(50), "Đã bị gỡ")
      .query(
        `UPDATE dbo.du_an SET trang_thai_du_an = @trang_thai_du_an WHERE ma_du_an = @ma_du_an`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy dự án." });
    }

    return res.json({ message: "Xóa dự án thành công.", ma_du_an });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi xóa dự án." });
  }
});

// ── List deleted projects ──
app.get("/projects/personal/deleted", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Thiếu access token." });
    let decoded;
    try { decoded = verifyAccessToken(token); } catch { return res.status(401).json({ error: "Access token không hợp lệ." }); }
    if (!decoded) return res.status(401).json({ error: "Access token không hợp lệ." });

    const ma_nhan_vien = String(decoded.sub);
    const pool = await poolPromise;
    const duAnCols = await getDuAnColumns(pool);
    if (!duAnCols.has("trang_thai_du_an")) {
      return res.json({ projects: [] });
    }

    const hasThanhVienNhom = await tableExists(pool, "thanh_vien_nhom");
    const query = hasThanhVienNhom
      ? `SELECT DISTINCT da.ma_du_an, da.ten_du_an, da.ma_phong_ban
         FROM dbo.du_an da
         LEFT JOIN dbo.phu_trach pt ON pt.ma_cong_viec IN (SELECT ma_cong_viec FROM dbo.cong_viec WHERE ma_du_an = da.ma_du_an)
         LEFT JOIN dbo.thanh_vien_nhom tvn ON tvn.ma_nhom = da.ma_nhom
         WHERE da.trang_thai_du_an = N'Đã bị gỡ'
           AND (pt.ma_nhan_vien = @ma_nhan_vien OR tvn.ma_nhan_vien = @ma_nhan_vien)
         ORDER BY da.ten_du_an ASC`
      : `SELECT DISTINCT da.ma_du_an, da.ten_du_an, da.ma_phong_ban
         FROM dbo.du_an da
         INNER JOIN dbo.cong_viec cv ON cv.ma_du_an = da.ma_du_an
         INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
         WHERE da.trang_thai_du_an = N'Đã bị gỡ'
           AND pt.ma_nhan_vien = @ma_nhan_vien
         ORDER BY da.ten_du_an ASC`;

    const result = await pool.request().input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien).query(query);
    return res.json({ projects: result.recordset });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi lấy dự án đã xóa." });
  }
});

// ── Restore deleted project ──
app.patch("/projects/personal/:ma_du_an/restore", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Thiếu access token." });
    let decoded;
    try { decoded = verifyAccessToken(token); } catch { return res.status(401).json({ error: "Access token không hợp lệ." }); }
    if (!decoded) return res.status(401).json({ error: "Access token không hợp lệ." });

    const ma_du_an = String(req.params.ma_du_an || "").trim();
    if (!ma_du_an) return res.status(400).json({ error: "Thiếu mã dự án." });

    const pool = await poolPromise;
    const duAnCols = await getDuAnColumns(pool);
    if (!duAnCols.has("trang_thai_du_an")) {
      return res.status(400).json({ error: "Bảng du_an chưa có cột trang_thai_du_an." });
    }

    const result = await pool.request()
      .input("ma_du_an", sql.VarChar(25), ma_du_an)
      .input("trang_thai_du_an", sql.NVarChar(50), "Đang thực hiện")
      .query(
        `UPDATE dbo.du_an SET trang_thai_du_an = @trang_thai_du_an WHERE ma_du_an = @ma_du_an AND trang_thai_du_an = N'Đã bị gỡ'`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy dự án hoặc dự án chưa bị xóa." });
    }

    return res.json({ message: "Khôi phục dự án thành công.", ma_du_an });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi khôi phục dự án." });
  }
});

// ── Permanent delete project (set trang_thai_du_an = 'Đã bị xóa') ──
app.patch("/projects/personal/:ma_du_an/permanent-delete", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Thiếu access token." });
    let decoded;
    try { decoded = verifyAccessToken(token); } catch { return res.status(401).json({ error: "Access token không hợp lệ." }); }
    if (!decoded) return res.status(401).json({ error: "Access token không hợp lệ." });

    const ma_du_an = String(req.params.ma_du_an || "").trim();
    if (!ma_du_an) return res.status(400).json({ error: "Thiếu mã dự án." });

    const pool = await poolPromise;
    const duAnCols = await getDuAnColumns(pool);
    if (!duAnCols.has("trang_thai_du_an")) {
      return res.status(400).json({ error: "Bảng du_an chưa có cột trang_thai_du_an." });
    }

    const result = await pool.request()
      .input("ma_du_an", sql.VarChar(25), ma_du_an)
      .input("trang_thai_du_an", sql.NVarChar(50), "Đã bị xóa")
      .query(
        `UPDATE dbo.du_an SET trang_thai_du_an = @trang_thai_du_an WHERE ma_du_an = @ma_du_an AND trang_thai_du_an = N'Đã bị gỡ'`
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy dự án hoặc dự án chưa ở trạng thái đã bị gỡ." });
    }

    return res.json({ message: "Xóa vĩnh viễn dự án thành công.", ma_du_an });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi xóa vĩnh viễn dự án." });
  }
});

app.get("/projects/personal/setup", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Thiếu access token." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    if (!decoded) {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    const pool = await poolPromise;
    const membersResult = await pool.request().query(
      `SELECT ma_nhan_vien, ten_nv, ma_phong_ban, trang_thai_hoat_dong
       FROM dbo.nhan_vien
       ORDER BY ten_nv ASC`,
    );
    let departments = [];
    try {
      const departmentsResult = await pool.request().query(
        `SELECT ma_phong_ban, ten_phong_ban
         FROM dbo.phong_ban
         ORDER BY ten_phong_ban ASC`,
      );
      departments = departmentsResult.recordset || [];
    } catch {
      departments = [];
    }

    const members = membersResult.recordset
      .map((row) => ({
        ma_nhan_vien: row.ma_nhan_vien,
        ten_nv: row.ten_nv,
        ma_phong_ban: row.ma_phong_ban,
        trang_thai_hoat_dong: row.trang_thai_hoat_dong || null,
      }));

    if (!departments.length) {
      const departmentMap = new Map();
      for (const member of members) {
        const departmentId = String(member.ma_phong_ban || "").trim();
        if (!departmentId) continue;
        if (!departmentMap.has(departmentId)) {
          departmentMap.set(departmentId, {
            ma_phong_ban: departmentId,
            ten_phong_ban: departmentId,
          });
        }
      }
      departments = Array.from(departmentMap.values()).sort((a, b) => a.ten_phong_ban.localeCompare(b.ten_phong_ban, "vi"));
    }

    return res.json({
      departments,
      members,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi tải dữ liệu tạo dự án." });
  }
});

app.post("/projects/personal", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Thiếu access token." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    if (!decoded) {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    const ma_nhan_vien = String(decoded.sub);
    const ten_du_an = String(req.body?.ten_du_an || "").trim();
    const ma_phong_ban = String(req.body?.ma_phong_ban || "").trim();
    const mo_ta = String(req.body?.mo_ta || "").trim();
    const ngay_bat_dau_raw = req.body?.ngay_bat_dau;
    const ngay_ket_thuc_raw = req.body?.ngay_ket_thuc;
    const ngay_tao_du_an_raw = req.body?.ngay_tao_du_an;
    const thiet_lap_trien_khai = Number.parseInt(String(req.body?.thiet_lap_trien_khai || "0"), 10);
    const thiet_lap_den_han = Number.parseInt(String(req.body?.thiet_lap_den_han || "0"), 10);
    const muc_do_uu_tien = String(req.body?.muc_do_uu_tien || "Trung bình").trim();
    const memberIdsRaw = Array.isArray(req.body?.member_ids) ? req.body.member_ids : [];
    const memberIds = Array.from(
      new Set(
        memberIdsRaw
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ),
    );

    if (!ten_du_an) {
      return res.status(400).json({ error: "Vui lòng nhập tên dự án." });
    }
    if (!ma_phong_ban) {
      return res.status(400).json({ error: "Vui lòng chọn phòng ban." });
    }

    const ngay_bat_dau = toIsoOrNull(ngay_bat_dau_raw);
    const ngay_ket_thuc = toIsoOrNull(ngay_ket_thuc_raw);
    const ngay_tao_du_an = toIsoOrNull(ngay_tao_du_an_raw) || new Date().toISOString();

    if (!ngay_bat_dau || !ngay_ket_thuc) {
      return res.status(400).json({ error: "Vui lòng chọn ngày bắt đầu và ngày kết thúc." });
    }
    if (new Date(ngay_ket_thuc).getTime() < new Date(ngay_bat_dau).getTime()) {
      return res.status(400).json({ error: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu." });
    }
    if (!Number.isFinite(thiet_lap_trien_khai) || thiet_lap_trien_khai < 0) {
      return res.status(400).json({ error: "Thiết lập thời gian sắp triển khai không hợp lệ." });
    }
    if (!Number.isFinite(thiet_lap_den_han) || thiet_lap_den_han < 0) {
      return res.status(400).json({ error: "Thiết lập thời gian sắp đến hạn không hợp lệ." });
    }

    const pool = await poolPromise;
    const departmentCheck = await pool.request().input("ma_phong_ban", sql.VarChar(25), ma_phong_ban).query(
      `SELECT TOP 1 ma_phong_ban, ten_phong_ban
       FROM dbo.phong_ban
       WHERE ma_phong_ban = @ma_phong_ban`,
    );
    const department = departmentCheck.recordset[0];
    if (!department) {
      return res.status(400).json({ error: "Phòng ban không tồn tại." });
    }

    const validMembers = [];
    for (const memberId of memberIds) {
      const employeeResult = await pool
        .request()
        .input("ma_nhan_vien", sql.VarChar(25), memberId)
        .input("ma_phong_ban", sql.VarChar(25), ma_phong_ban)
        .query(
          `SELECT TOP 1 ma_nhan_vien, ten_nv, ma_phong_ban, trang_thai_hoat_dong
           FROM dbo.nhan_vien
           WHERE ma_nhan_vien = @ma_nhan_vien AND ma_phong_ban = @ma_phong_ban`,
        );
      const employee = employeeResult.recordset[0];
      if (employee && !isInactiveStatus(employee.trang_thai_hoat_dong)) {
        validMembers.push(employee.ma_nhan_vien);
      }
    }
    if (!validMembers.includes(ma_nhan_vien)) {
      validMembers.push(ma_nhan_vien);
    }

    const duAnColumns = await getDuAnColumns(pool);
    const hasNhomNhanVien = await tableExists(pool, "nhom_nhan_vien");
    const hasNhom = !hasNhomNhanVien && (await tableExists(pool, "nhom"));
    const hasThanhVienNhom = await tableExists(pool, "thanh_vien_nhom");
    const hasGroupTables = (hasNhomNhanVien || hasNhom) && hasThanhVienNhom;

    const ma_du_an = await generateProjectCode(pool);
    const ma_nhom = hasGroupTables ? `NDA${ma_du_an.replace(/^DA/i, "")}` : null;
    const now = new Date();

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      if (hasGroupTables && ma_nhom) {
        const groupTable = hasNhomNhanVien ? "nhom_nhan_vien" : "nhom";
        await new sql.Request(transaction)
          .input("ma_nhom", sql.VarChar(25), ma_nhom)
          .input("ten_nhom", sql.NVarChar(120), `Nhóm ${ten_du_an}`)
          .input("thong_tin", sql.NVarChar(sql.MAX), mo_ta || null)
          .input("nguoi_dung_nhom", sql.VarChar(25), ma_nhan_vien)
          .input("ngay_tao_nhom", sql.DateTime, now)
          .query(
            `INSERT INTO dbo.${groupTable} (ma_nhom, ten_nhom, thong_tin, nguoi_dung_nhom, ngay_tao_nhom)
             VALUES (@ma_nhom, @ten_nhom, @thong_tin, @nguoi_dung_nhom, @ngay_tao_nhom)`,
          );

        for (const memberId of validMembers) {
          await new sql.Request(transaction)
            .input("ma_nhom", sql.VarChar(25), ma_nhom)
            .input("ma_nhan_vien", sql.VarChar(25), memberId)
            .input("vai_tro", sql.NVarChar(50), memberId === ma_nhan_vien ? "Trưởng nhóm" : "Thành viên")
            .query(
              `IF NOT EXISTS (
                 SELECT 1
                 FROM dbo.thanh_vien_nhom
                 WHERE ma_nhan_vien = @ma_nhan_vien AND ma_nhom = @ma_nhom
               )
               INSERT INTO dbo.thanh_vien_nhom (ma_nhan_vien, ma_nhom, vai_tro)
               VALUES (@ma_nhan_vien, @ma_nhom, @vai_tro)`,
            );
        }
      }

      const request = new sql.Request(transaction)
        .input("ma_du_an", sql.VarChar(25), ma_du_an)
        .input("ma_phong_ban", sql.VarChar(25), ma_phong_ban)
        .input("ten_du_an", sql.NVarChar(150), ten_du_an)
        .input("mo_ta", sql.NVarChar(sql.MAX), mo_ta || null)
        .input("ngay_bat_dau", sql.DateTime, new Date(ngay_bat_dau))
        .input("ngay_ket_thuc", sql.DateTime, new Date(ngay_ket_thuc))
        .input("ngay_tao_du_an", sql.DateTime, new Date(ngay_tao_du_an))
        .input("muc_do_uu_tien", sql.NVarChar(30), muc_do_uu_tien)
        .input("thiet_lap_trien_khai", sql.Int, thiet_lap_trien_khai)
        .input("thiet_lap_den_han", sql.Int, thiet_lap_den_han);

      const columns = ["ma_du_an", "ma_phong_ban", "ten_du_an", "mo_ta", "ngay_bat_dau", "ngay_ket_thuc", "ngay_tao_du_an"];
      const values = ["@ma_du_an", "@ma_phong_ban", "@ten_du_an", "@mo_ta", "@ngay_bat_dau", "@ngay_ket_thuc", "@ngay_tao_du_an"];

      if (hasGroupTables && ma_nhom && duAnColumns.has("ma_nhom")) {
        request.input("ma_nhom", sql.VarChar(25), ma_nhom);
        columns.push("ma_nhom");
        values.push("@ma_nhom");
      }
      if (duAnColumns.has("muc_do_uu_tien")) {
        columns.push("muc_do_uu_tien");
        values.push("@muc_do_uu_tien");
      } else if (duAnColumns.has("do_uu_tien")) {
        columns.push("do_uu_tien");
        values.push("@muc_do_uu_tien");
      }
      if (duAnColumns.has("thiet_lap_trien_khai")) {
        columns.push("thiet_lap_trien_khai");
        values.push("@thiet_lap_trien_khai");
      }
      if (duAnColumns.has("thiet_lap_ket_thuc")) {
        columns.push("thiet_lap_ket_thuc");
        values.push("@thiet_lap_den_han");
      } else if (duAnColumns.has("thiet_lap_den_han")) {
        columns.push("thiet_lap_den_han");
        values.push("@thiet_lap_den_han");
      }

      // Nhiệm vụ 1: Auto-set trang_thai_du_an based on ngay_bat_dau vs ngay_tao_du_an
      if (duAnColumns.has("trang_thai_du_an")) {
        const startDate = new Date(ngay_bat_dau);
        const creationDate = new Date(ngay_tao_du_an);
        // Compare dates only (ignore time)
        const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
        const creationDay = new Date(creationDate.getFullYear(), creationDate.getMonth(), creationDate.getDate()).getTime();
        let trang_thai_du_an;
        if (startDay > creationDay) {
          trang_thai_du_an = "Chưa bắt đầu";
        } else {
          trang_thai_du_an = "Đang thực hiện";
        }
        request.input("trang_thai_du_an", sql.NVarChar(50), trang_thai_du_an);
        columns.push("trang_thai_du_an");
        values.push("@trang_thai_du_an");
      }

      await request.query(
        `INSERT INTO dbo.du_an (${columns.join(", ")})
         VALUES (${values.join(", ")})`,
      );

      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }

    return res.status(201).json({
      project: {
        ma_du_an,
        ten_du_an,
        ma_phong_ban,
        ten_phong_ban: department.ten_phong_ban,
        so_luong_cong_viec: 0,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi tạo dự án." });
  }
});

app.get("/tasks/personal", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Thiếu access token." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    if (!decoded) {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    const ma_nhan_vien = String(decoded.sub);
    const projectId = String(req.query?.project || "").trim();
    const pool = await poolPromise;
    const request = pool.request().input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien);
    if (projectId) {
      request.input("ma_du_an", sql.VarChar(25), projectId);
    }

    const query = projectId
      ? `SELECT
          cv.ma_cong_viec,
          cv.tieu_de,
          cv.trang_thai_cong_viec,
          cv.do_uu_tien,
          ISNULL(ISNULL(cv.ngay_tao, cv.ngay_cap_nhat), GETDATE()) AS ngay_tao,
          cv.han_hoan_thanh,
          da.ma_du_an,
          da.ten_du_an
       FROM dbo.phu_trach pt
       INNER JOIN dbo.cong_viec cv ON cv.ma_cong_viec = pt.ma_cong_viec
       LEFT JOIN dbo.du_an da ON da.ma_du_an = cv.ma_du_an
       WHERE pt.ma_nhan_vien = @ma_nhan_vien AND cv.ma_du_an = @ma_du_an
       ORDER BY
         CASE WHEN cv.han_hoan_thanh IS NULL THEN 1 ELSE 0 END,
         cv.han_hoan_thanh ASC`
      : `SELECT
          cv.ma_cong_viec,
          cv.tieu_de,
          cv.trang_thai_cong_viec,
          cv.do_uu_tien,
          ISNULL(ISNULL(cv.ngay_tao, cv.ngay_cap_nhat), GETDATE()) AS ngay_tao,
          cv.han_hoan_thanh,
          da.ma_du_an,
          da.ten_du_an
       FROM dbo.phu_trach pt
       INNER JOIN dbo.cong_viec cv ON cv.ma_cong_viec = pt.ma_cong_viec
       LEFT JOIN dbo.du_an da ON da.ma_du_an = cv.ma_du_an
       WHERE pt.ma_nhan_vien = @ma_nhan_vien
       ORDER BY
         CASE WHEN cv.han_hoan_thanh IS NULL THEN 1 ELSE 0 END,
         cv.han_hoan_thanh ASC`;

    const result = await request.query(query);

    // Collect unique task IDs
    const uniqueTaskIds = [...new Set(result.recordset.map((row) => row.ma_cong_viec))];

    // Fetch all assignees for these tasks
    let assigneesMap = new Map();
    if (uniqueTaskIds.length > 0) {
      const assigneeQuery = await pool
        .request()
        .query(
          `SELECT pt2.ma_cong_viec, pt2.ma_nhan_vien, nv2.ten_nv
           FROM dbo.phu_trach pt2
           INNER JOIN dbo.nhan_vien nv2 ON nv2.ma_nhan_vien = pt2.ma_nhan_vien
           WHERE pt2.ma_cong_viec IN (${uniqueTaskIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")})`,
        );
      for (const row of assigneeQuery.recordset) {
        if (!assigneesMap.has(row.ma_cong_viec)) {
          assigneesMap.set(row.ma_cong_viec, []);
        }
        assigneesMap.get(row.ma_cong_viec).push({
          ma_nhan_vien: row.ma_nhan_vien,
          ten_nv: row.ten_nv,
        });
      }
    }

    const tasks = result.recordset
      .map((row) => ({
        ma_cong_viec: row.ma_cong_viec,
        tieu_de: row.tieu_de,
        trang_thai_cong_viec: row.trang_thai_cong_viec || null,
        do_uu_tien: row.do_uu_tien || null,
        ngay_tao: toIsoOrNull(row.ngay_tao) || new Date().toISOString(),
        han_hoan_thanh: toIsoOrNull(row.han_hoan_thanh),
        ma_du_an: row.ma_du_an || null,
        ten_du_an: row.ten_du_an || null,
        status_key: mapTaskStatusKey(row.trang_thai_cong_viec),
        assignees: assigneesMap.get(row.ma_cong_viec) || [],
      }))
      .filter((task) => !isDeletedStatus(task.trang_thai_cong_viec));

    return res.json({ tasks });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi lấy công việc cá nhân." });
  }
});

app.post("/tasks/personal", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Thiếu access token." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    if (!decoded) {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    const ma_nhan_vien = String(decoded.sub);
    const ma_du_an = String(req.body?.ma_du_an || "").trim();
    const tieu_de = String(req.body?.tieu_de || "").trim();
    const mo_ta = String(req.body?.mo_ta || "").trim();
    const do_uu_tien = String(req.body?.do_uu_tien || "Trung bình").trim();
    const status_key = String(req.body?.status_key || "todo").trim();
    const han_hoan_thanh_raw = String(req.body?.han_hoan_thanh || "").trim();

    if (!ma_du_an || !tieu_de) {
      return res.status(400).json({ error: "Thiếu thông tin công việc bắt buộc." });
    }

    if (!status_key) {
      return res.status(400).json({ error: "Trạng thái công việc không hợp lệ." });
    }

    const han_hoan_thanh = han_hoan_thanh_raw ? new Date(han_hoan_thanh_raw) : null;
    if (han_hoan_thanh && Number.isNaN(han_hoan_thanh.getTime())) {
      return res.status(400).json({ error: "Hạn hoàn thành không hợp lệ." });
    }

    const pool = await poolPromise;
    const projectCheck = await pool.request().input("ma_du_an", sql.VarChar(25), ma_du_an).query(
      `SELECT TOP 1 ma_du_an, ten_du_an
       FROM dbo.du_an
       WHERE ma_du_an = @ma_du_an`,
    );
    const project = projectCheck.recordset[0];
    if (!project) {
      return res.status(404).json({ error: "Không tìm thấy dự án." });
    }

    const ma_cong_viec = await generateTaskCode(pool);
    const trang_thai_cong_viec = statusKeyToDbValue(status_key);
    const now = new Date();

    await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .input("ma_du_an", sql.VarChar(25), ma_du_an)
      .input("tieu_de", sql.NVarChar(150), tieu_de)
      .input("mo_ta", sql.NVarChar(sql.MAX), mo_ta || null)
      .input("trang_thai_cong_viec", sql.NVarChar(50), trang_thai_cong_viec)
      .input("do_uu_tien", sql.NVarChar(25), do_uu_tien)
      .input("ngay_tao", sql.DateTime, now)
      .input("han_hoan_thanh", sql.DateTime, han_hoan_thanh)
      .query(
        `INSERT INTO dbo.cong_viec
          (ma_cong_viec, ma_du_an, tieu_de, mo_ta, trang_thai_cong_viec, do_uu_tien, ngay_tao, han_hoan_thanh)
         VALUES
          (@ma_cong_viec, @ma_du_an, @tieu_de, @mo_ta, @trang_thai_cong_viec, @do_uu_tien, @ngay_tao, @han_hoan_thanh)`,
      );

    await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `INSERT INTO dbo.phu_trach (ma_cong_viec, ma_nhan_vien)
         VALUES (@ma_cong_viec, @ma_nhan_vien)`,
      );

    const createdResult = await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .query(
        `SELECT TOP 1 ISNULL(ngay_tao, ngay_cap_nhat) AS ngay_tao
         FROM dbo.cong_viec
         WHERE ma_cong_viec = @ma_cong_viec`,
      );
    const ngay_tao = createdResult.recordset[0]?.ngay_tao || now;

    const assigneeResult = await pool
      .request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT TOP 1 ten_nv
         FROM dbo.nhan_vien
         WHERE ma_nhan_vien = @ma_nhan_vien`,
      );
    const assigneeName = assigneeResult.recordset[0]?.ten_nv || null;

    return res.status(201).json({
      task: {
        ma_cong_viec,
        ma_du_an,
        tieu_de,
        trang_thai_cong_viec,
        do_uu_tien,
        ngay_tao: toIsoOrNull(ngay_tao) || now.toISOString(),
        han_hoan_thanh: han_hoan_thanh ? han_hoan_thanh.toISOString() : null,
        ma_nhan_vien_phu_trach: ma_nhan_vien,
        ten_nguoi_phu_trach: assigneeName,
        ten_du_an: project.ten_du_an || ma_du_an,
        status_key,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi tạo công việc." });
  }
});

app.patch("/tasks/personal/:ma_cong_viec", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Thi?u access token." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Access token kh�ng h?p l?." });
    }

    if (!decoded) {
      return res.status(401).json({ error: "Access token kh�ng h?p l?." });
    }

    const ma_nhan_vien = String(decoded.sub);
    const ma_cong_viec = String(req.params?.ma_cong_viec || "").trim();
    const status_raw = String(req.body?.status_key || "").trim();
    const status_key = parseRequestedStatusKey(status_raw);

    if (!ma_cong_viec) {
      return res.status(400).json({ error: "Thi?u m� c�ng vi?c." });
    }
    if (!status_key) {
      return res.status(400).json({ error: "Tr?ng th�i c�ng vi?c kh�ng h?p l?." });
    }

    const trang_thai_cong_viec = statusKeyToDbValue(status_key);
    const pool = await poolPromise;
    if (status_key === "deleted") {
      await ensureTaskTrashTable(pool);
    }

    const updateResult = await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .input("trang_thai_cong_viec", sql.NVarChar(50), trang_thai_cong_viec)
      .query(
        `UPDATE cv
         SET cv.trang_thai_cong_viec = @trang_thai_cong_viec
         FROM dbo.cong_viec cv
         INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
         WHERE cv.ma_cong_viec = @ma_cong_viec
           AND pt.ma_nhan_vien = @ma_nhan_vien`,
      );

    if (!updateResult.rowsAffected?.[0]) {
      return res.status(404).json({ error: "Kh�ng t�m th?y c�ng vi?c c?a b?n d? c?p nh?t." });
    }

    if (status_key === "deleted") {
      await pool
        .request()
        .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
        .input("deleted_by", sql.VarChar(25), ma_nhan_vien)
        .query(
          `MERGE dbo.task_trash_logs AS target
           USING (SELECT @ma_cong_viec AS ma_cong_viec) AS source
           ON target.ma_cong_viec = source.ma_cong_viec
           WHEN MATCHED THEN
             UPDATE SET deleted_by = @deleted_by, deleted_at = SYSUTCDATETIME()
           WHEN NOT MATCHED THEN
             INSERT (ma_cong_viec, deleted_by, deleted_at)
             VALUES (@ma_cong_viec, @deleted_by, SYSUTCDATETIME());`,
        );
    }

    return res.json({
      message: "C?p nh?t tr?ng th�i c�ng vi?c th�nh c�ng.",
      task: {
        ma_cong_viec,
        trang_thai_cong_viec,
        status_key,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "L?i m�y ch? khi c?p nh?t tr?ng th�i c�ng vi?c." });
  }
});

app.post("/tasks/personal/:ma_cong_viec/assignees", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Thiáº¿u access token." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Access token khÃ´ng há»£p lá»‡." });
    }

    if (!decoded) {
      return res.status(401).json({ error: "Access token khÃ´ng há»£p lá»‡." });
    }

    const requesterId = String(decoded.sub);
    const ma_cong_viec = String(req.params?.ma_cong_viec || "").trim();
    const ma_nhan_vien = String(req.body?.ma_nhan_vien || "").trim();

    if (!ma_cong_viec || !ma_nhan_vien) {
      return res.status(400).json({ error: "Thiáº¿u mÃ£ cÃ´ng viá»‡c hoáº·c mÃ£ nhÃ¢n viÃªn." });
    }

    const pool = await poolPromise;

    const accessCheck = await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .input("requesterId", sql.VarChar(25), requesterId)
      .query(
        `SELECT TOP 1 pt.ma_cong_viec
         FROM dbo.phu_trach pt
         WHERE pt.ma_cong_viec = @ma_cong_viec AND pt.ma_nhan_vien = @requesterId`,
      );

    if (!accessCheck.recordset[0]) {
      return res.status(403).json({ error: "Báº¡n khÃ´ng cÃ³ quyá»n cáº­p nháº­t cÃ´ng viá»‡c nÃ y." });
    }

    const employeeResult = await pool
      .request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT TOP 1 ma_nhan_vien, ten_nv
         FROM dbo.nhan_vien
         WHERE ma_nhan_vien = @ma_nhan_vien`,
      );

    const employee = employeeResult.recordset[0];
    if (!employee) {
      return res.status(404).json({ error: "KhÃ´ng tÃ¬m tháº¥y nhÃ¢n viÃªn." });
    }

    const existsResult = await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT TOP 1 ma_cong_viec
         FROM dbo.phu_trach
         WHERE ma_cong_viec = @ma_cong_viec AND ma_nhan_vien = @ma_nhan_vien`,
      );

    if (!existsResult.recordset[0]) {
      await pool
        .request()
        .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
        .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
        .query(
          `INSERT INTO dbo.phu_trach (ma_cong_viec, ma_nhan_vien)
           VALUES (@ma_cong_viec, @ma_nhan_vien)`,
        );
    }

    return res.status(201).json({
      message: "ThÃªm ngÆ°á»i lÃ m cho cÃ´ng viá»‡c thÃ nh cÃ´ng.",
      assignee: {
        ma_nhan_vien: employee.ma_nhan_vien,
        ten_nv: employee.ten_nv,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lá»—i mÃ¡y chá»§ khi thÃªm ngÆ°á»i lÃ m." });
  }
});

app.patch("/tasks/personal/:ma_cong_viec/delete", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Thiếu access token." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    if (!decoded) {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    const ma_nhan_vien = String(decoded.sub);
    const ma_cong_viec = String(req.params?.ma_cong_viec || "").trim();
    if (!ma_cong_viec) {
      return res.status(400).json({ error: "Thiếu mã công việc." });
    }

    const pool = await poolPromise;
    await ensureTaskTrashTable(pool);

    const updateResult = await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .input("trang_thai_xoa", sql.NVarChar(50), statusKeyToDbValue("deleted"))
      .query(
        `UPDATE cv
         SET cv.trang_thai_cong_viec = @trang_thai_xoa
         FROM dbo.cong_viec cv
         INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
         WHERE cv.ma_cong_viec = @ma_cong_viec
           AND pt.ma_nhan_vien = @ma_nhan_vien`,
      );

    if (!updateResult.rowsAffected?.[0]) {
      return res.status(404).json({ error: "Không tìm thấy công việc để xóa." });
    }

    await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .input("deleted_by", sql.VarChar(25), ma_nhan_vien)
      .query(
        `MERGE dbo.task_trash_logs AS target
         USING (SELECT @ma_cong_viec AS ma_cong_viec) AS source
         ON target.ma_cong_viec = source.ma_cong_viec
         WHEN MATCHED THEN
           UPDATE SET deleted_by = @deleted_by, deleted_at = SYSUTCDATETIME()
         WHEN NOT MATCHED THEN
           INSERT (ma_cong_viec, deleted_by, deleted_at)
           VALUES (@ma_cong_viec, @deleted_by, SYSUTCDATETIME());`,
      );

    return res.json({ message: "Đã chuyển công việc vào thùng rác." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi xóa công việc." });
  }
});

app.get("/tasks/personal/deleted", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Thiếu access token." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    if (!decoded) {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    const ma_nhan_vien = String(decoded.sub);
    const pool = await poolPromise;
    await ensureTaskTrashTable(pool);

    const result = await pool
      .request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT
            cv.ma_cong_viec,
            cv.tieu_de,
            cv.trang_thai_cong_viec,
            cv.do_uu_tien,
            ISNULL(ISNULL(cv.ngay_tao, cv.ngay_cap_nhat), GETDATE()) AS ngay_tao,
            cv.han_hoan_thanh,
            da.ma_du_an,
            da.ten_du_an,
            tl.deleted_at,
            tl.deleted_by,
            nv_del.ten_nv AS ten_nguoi_xoa
         FROM dbo.phu_trach pt
         INNER JOIN dbo.cong_viec cv ON cv.ma_cong_viec = pt.ma_cong_viec
         LEFT JOIN dbo.du_an da ON da.ma_du_an = cv.ma_du_an
         LEFT JOIN dbo.task_trash_logs tl ON tl.ma_cong_viec = cv.ma_cong_viec
         LEFT JOIN dbo.nhan_vien nv_del ON nv_del.ma_nhan_vien = tl.deleted_by
         WHERE pt.ma_nhan_vien = @ma_nhan_vien
         ORDER BY tl.deleted_at DESC, cv.ngay_cap_nhat DESC`,
      );

    const tasks = result.recordset
      .filter((row) => isDeletedStatus(row.trang_thai_cong_viec))
      .map((row) => ({
        ma_cong_viec: row.ma_cong_viec,
        tieu_de: row.tieu_de,
        trang_thai_cong_viec: row.trang_thai_cong_viec || null,
        do_uu_tien: row.do_uu_tien || null,
        ngay_tao: toIsoOrNull(row.ngay_tao),
        han_hoan_thanh: toIsoOrNull(row.han_hoan_thanh),
        ma_du_an: row.ma_du_an || null,
        ten_du_an: row.ten_du_an || null,
        deleted_at: toIsoOrNull(row.deleted_at),
        deleted_by: row.deleted_by || null,
        ten_nguoi_xoa: row.ten_nguoi_xoa || null,
      }));

    return res.json({ tasks });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi lấy công việc đã xóa." });
  }
});

app.patch("/tasks/personal/:ma_cong_viec/restore", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Thiếu access token." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    if (!decoded) {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    const ma_nhan_vien = String(decoded.sub);
    const ma_cong_viec = String(req.params?.ma_cong_viec || "").trim();
    const status_key = String(req.body?.status_key || "todo").trim();
    if (!["todo", "in_progress"].includes(status_key)) {
      return res.status(400).json({ error: "Trạng thái khôi phục không hợp lệ." });
    }

    const pool = await poolPromise;
    await ensureTaskTrashTable(pool);

    const updateResult = await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .input("trang_thai", sql.NVarChar(50), statusKeyToDbValue(status_key))
      .query(
        `UPDATE cv
         SET cv.trang_thai_cong_viec = @trang_thai
         FROM dbo.cong_viec cv
         INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
         WHERE cv.ma_cong_viec = @ma_cong_viec
           AND pt.ma_nhan_vien = @ma_nhan_vien`,
      );

    if (!updateResult.rowsAffected?.[0]) {
      return res.status(404).json({ error: "Không tìm thấy công việc để khôi phục." });
    }

    await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .query(`DELETE FROM dbo.task_trash_logs WHERE ma_cong_viec = @ma_cong_viec`);

    return res.json({ message: "Khôi phục công việc thành công." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi khôi phục công việc." });
  }
});

app.delete("/tasks/personal/:ma_cong_viec/permanent", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Thiếu access token." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    if (!decoded) {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    const ma_nhan_vien = String(decoded.sub);
    const ma_cong_viec = String(req.params?.ma_cong_viec || "").trim();
    if (!ma_cong_viec) {
      return res.status(400).json({ error: "Thiếu mã công việc." });
    }

    const pool = await poolPromise;
    await ensureTaskTrashTable(pool);

    const accessCheck = await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT TOP 1 cv.trang_thai_cong_viec
         FROM dbo.cong_viec cv
         INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
         WHERE cv.ma_cong_viec = @ma_cong_viec
           AND pt.ma_nhan_vien = @ma_nhan_vien`,
      );

    const currentRow = accessCheck.recordset[0];
    if (!currentRow) {
      return res.status(404).json({ error: "Không tìm thấy công việc để xóa vĩnh viễn." });
    }
    if (!isDeletedStatus(currentRow.trang_thai_cong_viec)) {
      return res.status(400).json({ error: "Chỉ xóa vĩnh viễn công việc đang ở thùng rác." });
    }

    await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .query(`DELETE FROM dbo.task_trash_logs WHERE ma_cong_viec = @ma_cong_viec`);

    await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .query(`DELETE FROM dbo.phu_trach WHERE ma_cong_viec = @ma_cong_viec`);

    const deletedTask = await pool
      .request()
      .input("ma_cong_viec", sql.VarChar(25), ma_cong_viec)
      .query(`DELETE FROM dbo.cong_viec WHERE ma_cong_viec = @ma_cong_viec`);

    if (!deletedTask.rowsAffected?.[0]) {
      return res.status(404).json({ error: "Không tìm thấy công việc để xóa vĩnh viễn." });
    }

    return res.json({ message: "Đã xóa vĩnh viễn công việc." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không thể xóa vĩnh viễn công việc. Có thể còn dữ liệu liên quan." });
  }
});

app.post("/auth/logout", async (req, res) => {
  try {
    const refreshToken = String(req.body?.refreshToken || "");
    if (!refreshToken) {
      return res.status(400).json({ error: "Thiếu refresh token." });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, {
        algorithms: ["HS256"],
        issuer: JWT_ISSUER,
      });
    } catch {
      return res.status(401).json({ error: "Refresh token không hợp lệ." });
    }

    if (!decoded || decoded.type !== "refresh" || !decoded.sub || !decoded.tokenId) {
      return res.status(401).json({ error: "Refresh token không hợp lệ." });
    }

    const ma_nhan_vien = String(decoded.sub);
    const tokenId = String(decoded.tokenId);
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const row = await getRefreshTokenRow(pool, { tokenId, ma_nhan_vien });
    if (!row) {
      // Token not found -> treat as already logged out.
      return res.json({ ok: true });
    }

    const incomingHash = sha256Buffer(refreshToken);
    const storedHash = row.token_hash;
    if (storedHash && Buffer.isBuffer(storedHash) && storedHash.length === incomingHash.length) {
      if (crypto.timingSafeEqual(storedHash, incomingHash)) {
        await revokeRefreshTokenWithoutReplacement(pool, { tokenId });
        return res.json({ ok: true });
      }
    }

    return res.status(401).json({ error: "Refresh token không hợp lệ." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi đăng xuất." });
  }
});

// Nhiệm vụ 3 & 4: API to get project members from thanh_vien_nhom
app.get("/projects/personal/:ma_du_an/members", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Thiếu access token." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    if (!decoded) {
      return res.status(401).json({ error: "Access token không hợp lệ." });
    }

    const ma_du_an = String(req.params?.ma_du_an || "").trim();
    if (!ma_du_an) {
      return res.status(400).json({ error: "Thiếu mã dự án." });
    }

    const pool = await poolPromise;
    const hasThanhVienNhom = await tableExists(pool, "thanh_vien_nhom");

    if (!hasThanhVienNhom) {
      return res.json({ members: [] });
    }

    const result = await pool
      .request()
      .input("ma_du_an", sql.VarChar(25), ma_du_an)
      .query(
        `SELECT DISTINCT
            nv.ma_nhan_vien,
            nv.ten_nv,
            nv.ma_phong_ban,
            tvn.vai_tro
         FROM dbo.du_an da
         INNER JOIN dbo.thanh_vien_nhom tvn ON tvn.ma_nhom = da.ma_nhom
         INNER JOIN dbo.nhan_vien nv ON nv.ma_nhan_vien = tvn.ma_nhan_vien
         WHERE da.ma_du_an = @ma_du_an
         ORDER BY nv.ten_nv ASC`,
      );

    const members = result.recordset.map((row) => ({
      ma_nhan_vien: row.ma_nhan_vien,
      ten_nv: row.ten_nv,
      ma_phong_ban: row.ma_phong_ban,
      vai_tro: row.vai_tro || null,
    }));

    return res.json({ members });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi lấy thành viên dự án." });
  }
});

// ── Analytics Dashboard API ──────────────────────────────────────────
app.get("/analytics/dashboard", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Thiếu access token." });
    let decoded;
    try { decoded = verifyAccessToken(token); } catch { return res.status(401).json({ error: "Access token không hợp lệ." }); }
    if (!decoded) return res.status(401).json({ error: "Access token không hợp lệ." });

    const ma_nhan_vien = String(decoded.sub);
    const pool = await poolPromise;
    const hasThanhVienNhom = await tableExists(pool, "thanh_vien_nhom");

    // 1. Task Status Distribution
    const statusQuery = await pool.request().input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien).query(
      `SELECT cv.trang_thai_cong_viec, COUNT(*) AS total
       FROM dbo.cong_viec cv
       INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
       WHERE pt.ma_nhan_vien = @ma_nhan_vien
         AND (cv.trang_thai_cong_viec IS NULL OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa'))
       GROUP BY cv.trang_thai_cong_viec`
    );

    const statusMap = {};
    let totalTasks = 0;
    for (const row of statusQuery.recordset) {
      const key = mapTaskStatusKey(row.trang_thai_cong_viec);
      const label = row.trang_thai_cong_viec || "Chưa phân loại";
      statusMap[key] = { label, count: row.total };
      totalTasks += row.total;
    }

    // 2. Task counts by status key
    const todoCount = (statusMap["todo"]?.count || 0);
    const inProgressCount = (statusMap["in_progress"]?.count || 0);
    const doneCount = (statusMap["done"]?.count || 0);
    const progressPercent = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

    // 3. Overdue tasks
    const overdueQuery = await pool.request().input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien).query(
      `SELECT COUNT(*) AS overdue_count
       FROM dbo.cong_viec cv
       INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
       WHERE pt.ma_nhan_vien = @ma_nhan_vien
         AND cv.han_hoan_thanh < GETDATE()
         AND cv.trang_thai_cong_viec NOT IN (N'Hoàn thành', N'Đã hoàn thành', N'Đã bị xóa', N'Đã xóa')
         AND cv.trang_thai_cong_viec IS NOT NULL`
    );
    const overdueCount = overdueQuery.recordset[0]?.overdue_count || 0;

    // 4. Workload per user (tasks assigned per team member in user's projects)
    const workloadQuery = hasThanhVienNhom
      ? await pool.request().input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien).query(
        `SELECT nv.ten_nv, nv.ma_nhan_vien,
                  COUNT(DISTINCT cv.ma_cong_viec) AS task_count,
                  SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Hoàn thành', N'Đã hoàn thành') THEN 1 ELSE 0 END) AS done_count,
                  SUM(CASE WHEN cv.han_hoan_thanh < GETDATE() AND cv.trang_thai_cong_viec NOT IN (N'Hoàn thành', N'Đã hoàn thành', N'Đã bị xóa', N'Đã xóa') THEN 1 ELSE 0 END) AS overdue_count
           FROM dbo.du_an da
           INNER JOIN dbo.thanh_vien_nhom tvn ON tvn.ma_nhom = da.ma_nhom
           INNER JOIN dbo.nhan_vien nv ON nv.ma_nhan_vien = tvn.ma_nhan_vien
           LEFT JOIN dbo.phu_trach pt2 ON pt2.ma_nhan_vien = nv.ma_nhan_vien
           LEFT JOIN dbo.cong_viec cv ON cv.ma_cong_viec = pt2.ma_cong_viec
                AND cv.ma_du_an = da.ma_du_an
                AND (cv.trang_thai_cong_viec IS NULL OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa'))
           WHERE da.ma_nhom IN (
             SELECT tvn2.ma_nhom FROM dbo.thanh_vien_nhom tvn2 WHERE tvn2.ma_nhan_vien = @ma_nhan_vien
           )
           AND (da.trang_thai_du_an IS NULL OR da.trang_thai_du_an <> N'Đã bị gỡ')
           GROUP BY nv.ten_nv, nv.ma_nhan_vien
           ORDER BY task_count DESC`
      )
      : await pool.request().input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien).query(
        `SELECT nv.ten_nv, pt.ma_nhan_vien,
                  COUNT(DISTINCT cv.ma_cong_viec) AS task_count,
                  SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Hoàn thành', N'Đã hoàn thành') THEN 1 ELSE 0 END) AS done_count,
                  SUM(CASE WHEN cv.han_hoan_thanh < GETDATE() AND cv.trang_thai_cong_viec NOT IN (N'Hoàn thành', N'Đã hoàn thành', N'Đã bị xóa', N'Đã xóa') THEN 1 ELSE 0 END) AS overdue_count
           FROM dbo.phu_trach pt
           INNER JOIN dbo.cong_viec cv ON cv.ma_cong_viec = pt.ma_cong_viec
           INNER JOIN dbo.nhan_vien nv ON nv.ma_nhan_vien = pt.ma_nhan_vien
           WHERE cv.ma_du_an IN (
             SELECT DISTINCT cv2.ma_du_an FROM dbo.phu_trach pt2
             INNER JOIN dbo.cong_viec cv2 ON cv2.ma_cong_viec = pt2.ma_cong_viec
             WHERE pt2.ma_nhan_vien = @ma_nhan_vien
           )
           AND (cv.trang_thai_cong_viec IS NULL OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa'))
           GROUP BY nv.ten_nv, pt.ma_nhan_vien
           ORDER BY task_count DESC`
      );

    const workload = workloadQuery.recordset.map((r) => ({
      name: r.ten_nv,
      ma_nhan_vien: r.ma_nhan_vien,
      task_count: r.task_count,
      done_count: r.done_count,
      overdue_count: r.overdue_count,
    }));

    // 5. Project progress
    const projectProgressQuery = await pool.request().input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien).query(
      hasThanhVienNhom
        ? `SELECT da.ma_du_an, da.ten_du_an, da.ngay_bat_dau, da.ngay_ket_thuc,
                  COUNT(DISTINCT cv.ma_cong_viec) AS total_tasks,
                  SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Hoàn thành', N'Đã hoàn thành') THEN 1 ELSE 0 END) AS done_tasks,
                  SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Đang thực hiện') THEN 1 ELSE 0 END) AS in_progress_tasks,
                  SUM(CASE WHEN cv.han_hoan_thanh < GETDATE() AND cv.trang_thai_cong_viec NOT IN (N'Hoàn thành', N'Đã hoàn thành', N'Đã bị xóa', N'Đã xóa') THEN 1 ELSE 0 END) AS overdue_tasks
           FROM dbo.du_an da
           INNER JOIN dbo.thanh_vien_nhom tvn ON tvn.ma_nhom = da.ma_nhom
           LEFT JOIN dbo.cong_viec cv ON cv.ma_du_an = da.ma_du_an
                AND (cv.trang_thai_cong_viec IS NULL OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa'))
           WHERE tvn.ma_nhan_vien = @ma_nhan_vien
             AND (da.trang_thai_du_an IS NULL OR da.trang_thai_du_an <> N'Đã bị gỡ')
           GROUP BY da.ma_du_an, da.ten_du_an, da.ngay_bat_dau, da.ngay_ket_thuc
           ORDER BY da.ten_du_an`
        : `SELECT da.ma_du_an, da.ten_du_an, da.ngay_bat_dau, da.ngay_ket_thuc,
                  COUNT(DISTINCT cv.ma_cong_viec) AS total_tasks,
                  SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Hoàn thành', N'Đã hoàn thành') THEN 1 ELSE 0 END) AS done_tasks,
                  SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Đang thực hiện') THEN 1 ELSE 0 END) AS in_progress_tasks,
                  SUM(CASE WHEN cv.han_hoan_thanh < GETDATE() AND cv.trang_thai_cong_viec NOT IN (N'Hoàn thành', N'Đã hoàn thành', N'Đã bị xóa', N'Đã xóa') THEN 1 ELSE 0 END) AS overdue_tasks
           FROM dbo.du_an da
           INNER JOIN dbo.cong_viec cv ON cv.ma_du_an = da.ma_du_an
           INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
           WHERE pt.ma_nhan_vien = @ma_nhan_vien
             AND (da.trang_thai_du_an IS NULL OR da.trang_thai_du_an <> N'Đã bị gỡ')
             AND (cv.trang_thai_cong_viec IS NULL OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa'))
           GROUP BY da.ma_du_an, da.ten_du_an, da.ngay_bat_dau, da.ngay_ket_thuc
           ORDER BY da.ten_du_an`
    );

    const projects = projectProgressQuery.recordset.map((r) => ({
      ma_du_an: r.ma_du_an,
      ten_du_an: r.ten_du_an,
      ngay_bat_dau: toIsoOrNull(r.ngay_bat_dau),
      ngay_ket_thuc: toIsoOrNull(r.ngay_ket_thuc),
      total_tasks: r.total_tasks,
      done_tasks: r.done_tasks,
      in_progress_tasks: r.in_progress_tasks,
      overdue_tasks: r.overdue_tasks,
      progress_percent: r.total_tasks > 0 ? Math.round((r.done_tasks / r.total_tasks) * 100) : 0,
    }));

    // 6. Task completion trend (weekly, last 8 weeks)
    const trendQuery = await pool.request().input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien).query(
      `SELECT
         DATEPART(ISO_WEEK, cv.ngay_cap_nhat) AS week_num,
         DATEPART(YEAR, cv.ngay_cap_nhat) AS year_num,
         MIN(cv.ngay_cap_nhat) AS week_start,
         COUNT(*) AS completed_count
       FROM dbo.cong_viec cv
       INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
       WHERE pt.ma_nhan_vien = @ma_nhan_vien
         AND cv.trang_thai_cong_viec IN (N'Hoàn thành', N'Đã hoàn thành')
         AND cv.ngay_cap_nhat IS NOT NULL
         AND cv.ngay_cap_nhat >= DATEADD(WEEK, -8, GETDATE())
       GROUP BY DATEPART(ISO_WEEK, cv.ngay_cap_nhat), DATEPART(YEAR, cv.ngay_cap_nhat)
       ORDER BY year_num, week_num`
    );

    const completionTrend = trendQuery.recordset.map((r) => ({
      week: `W${r.week_num}`,
      year: r.year_num,
      week_start: toIsoOrNull(r.week_start),
      completed: r.completed_count,
    }));

    // 7. Overdue tasks by project
    const overdueByProjectQuery = await pool.request().input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien).query(
      `SELECT da.ten_du_an, COUNT(*) AS overdue_count
       FROM dbo.cong_viec cv
       INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
       LEFT JOIN dbo.du_an da ON da.ma_du_an = cv.ma_du_an
       WHERE pt.ma_nhan_vien = @ma_nhan_vien
         AND cv.han_hoan_thanh < GETDATE()
         AND cv.trang_thai_cong_viec NOT IN (N'Hoàn thành', N'Đã hoàn thành', N'Đã bị xóa', N'Đã xóa')
         AND cv.trang_thai_cong_viec IS NOT NULL
       GROUP BY da.ten_du_an
       ORDER BY overdue_count DESC`
    );

    const overdueByProject = overdueByProjectQuery.recordset.map((r) => ({
      project: r.ten_du_an || "Không xác định",
      count: r.overdue_count,
    }));

    // 8. Average cycle time (days from ngay_tao to ngay_cap_nhat for completed tasks)
    const cycleTimeQuery = await pool.request().input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien).query(
      `SELECT
         AVG(DATEDIFF(HOUR, cv.ngay_tao, cv.ngay_cap_nhat) / 24.0) AS avg_cycle_days,
         MIN(DATEDIFF(HOUR, cv.ngay_tao, cv.ngay_cap_nhat) / 24.0) AS min_cycle_days,
         MAX(DATEDIFF(HOUR, cv.ngay_tao, cv.ngay_cap_nhat) / 24.0) AS max_cycle_days
       FROM dbo.cong_viec cv
       INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
       WHERE pt.ma_nhan_vien = @ma_nhan_vien
         AND cv.trang_thai_cong_viec IN (N'Hoàn thành', N'Đã hoàn thành')
         AND cv.ngay_tao IS NOT NULL
         AND cv.ngay_cap_nhat IS NOT NULL`
    );

    const cycleTime = {
      avg_days: cycleTimeQuery.recordset[0]?.avg_cycle_days != null
        ? parseFloat(Number(cycleTimeQuery.recordset[0].avg_cycle_days).toFixed(1))
        : null,
      min_days: cycleTimeQuery.recordset[0]?.min_cycle_days != null
        ? parseFloat(Number(cycleTimeQuery.recordset[0].min_cycle_days).toFixed(1))
        : null,
      max_days: cycleTimeQuery.recordset[0]?.max_cycle_days != null
        ? parseFloat(Number(cycleTimeQuery.recordset[0].max_cycle_days).toFixed(1))
        : null,
    };

    // 9. Unassigned tasks in user's projects
    const unassignedQuery = await pool.request().input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien).query(
      hasThanhVienNhom
        ? `SELECT COUNT(*) AS unassigned_count
           FROM dbo.cong_viec cv
           INNER JOIN dbo.du_an da ON da.ma_du_an = cv.ma_du_an
           INNER JOIN dbo.thanh_vien_nhom tvn ON tvn.ma_nhom = da.ma_nhom
           LEFT JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
           WHERE tvn.ma_nhan_vien = @ma_nhan_vien
             AND pt.ma_cong_viec IS NULL
             AND (cv.trang_thai_cong_viec IS NULL OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa'))
             AND (da.trang_thai_du_an IS NULL OR da.trang_thai_du_an <> N'Đã bị gỡ')`
        : `SELECT 0 AS unassigned_count`
    );
    const unassignedCount = unassignedQuery.recordset[0]?.unassigned_count || 0;

    return res.json({
      summary: {
        total_tasks: totalTasks,
        todo: todoCount,
        in_progress: inProgressCount,
        done: doneCount,
        overdue: overdueCount,
        unassigned: unassignedCount,
        progress_percent: progressPercent,
      },
      status_distribution: statusMap,
      workload,
      projects,
      completion_trend: completionTrend,
      overdue_by_project: overdueByProject,
      cycle_time: cycleTime,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi lấy dữ liệu phân tích." });
  }
});

// ── Eisenhower Matrix API ────────────────────────────────────────────
app.get("/analytics/eisenhower", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Thiếu access token." });
    let decoded;
    try { decoded = verifyAccessToken(token); } catch { return res.status(401).json({ error: "Access token không hợp lệ." }); }
    if (!decoded) return res.status(401).json({ error: "Access token không hợp lệ." });

    const ma_nhan_vien = String(decoded.sub);
    const pool = await poolPromise;

    // Fetch all active tasks for the user
    const result = await pool.request().input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien).query(
      `SELECT
         cv.ma_cong_viec,
         cv.tieu_de,
         cv.mo_ta,
         cv.trang_thai_cong_viec,
         cv.do_uu_tien,
         ISNULL(ISNULL(cv.ngay_tao, cv.ngay_cap_nhat), GETDATE()) AS ngay_tao,
         cv.han_hoan_thanh,
         cv.ngay_cap_nhat,
         da.ma_du_an,
         da.ten_du_an
       FROM dbo.phu_trach pt
       INNER JOIN dbo.cong_viec cv ON cv.ma_cong_viec = pt.ma_cong_viec
       LEFT JOIN dbo.du_an da ON da.ma_du_an = cv.ma_du_an
       WHERE pt.ma_nhan_vien = @ma_nhan_vien
         AND (cv.trang_thai_cong_viec IS NULL
              OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa', N'Hoàn thành', N'Đã hoàn thành'))
       ORDER BY cv.han_hoan_thanh ASC`
    );

    // Fetch assignees for all these tasks
    const taskIds = result.recordset.map((r) => r.ma_cong_viec);
    let assigneesMap = new Map();
    if (taskIds.length > 0) {
      const assigneeResult = await pool.request().query(
        `SELECT pt2.ma_cong_viec, pt2.ma_nhan_vien, nv2.ten_nv
         FROM dbo.phu_trach pt2
         INNER JOIN dbo.nhan_vien nv2 ON nv2.ma_nhan_vien = pt2.ma_nhan_vien
         WHERE pt2.ma_cong_viec IN (${taskIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")})`
      );
      for (const row of assigneeResult.recordset) {
        if (!assigneesMap.has(row.ma_cong_viec)) assigneesMap.set(row.ma_cong_viec, []);
        assigneesMap.get(row.ma_cong_viec).push({ ma_nhan_vien: row.ma_nhan_vien, ten_nv: row.ten_nv });
      }
    }

    const now = new Date();
    const urgentThresholdMs = 3 * 24 * 60 * 60 * 1000; // 3 days

    // Classify each task into Eisenhower quadrants
    const quadrants = {
      do_first: [],      // Urgent + Important
      schedule: [],      // Not Urgent + Important
      delegate: [],      // Urgent + Not Important
      eliminate: [],     // Not Urgent + Not Important
    };

    for (const row of result.recordset) {
      const priority = (row.do_uu_tien || "").trim();
      const deadline = row.han_hoan_thanh ? new Date(row.han_hoan_thanh) : null;

      // Determine importance: priority "Cao" = important
      const isImportant = priority.toLowerCase() === "cao";

      // Determine urgency: overdue OR due within 3 days
      let isUrgent = false;
      if (deadline) {
        const timeLeft = deadline.getTime() - now.getTime();
        isUrgent = timeLeft <= urgentThresholdMs; // includes overdue (negative)
      }
      // If no deadline but high priority, not urgent by deadline but still important
      // If no deadline and low priority, goes to eliminate

      const daysUntilDeadline = deadline
        ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const task = {
        ma_cong_viec: row.ma_cong_viec,
        tieu_de: row.tieu_de,
        mo_ta: row.mo_ta || null,
        trang_thai_cong_viec: row.trang_thai_cong_viec || null,
        do_uu_tien: row.do_uu_tien || null,
        ngay_tao: toIsoOrNull(row.ngay_tao),
        han_hoan_thanh: toIsoOrNull(row.han_hoan_thanh),
        ma_du_an: row.ma_du_an || null,
        ten_du_an: row.ten_du_an || null,
        status_key: mapTaskStatusKey(row.trang_thai_cong_viec),
        assignees: assigneesMap.get(row.ma_cong_viec) || [],
        is_urgent: isUrgent,
        is_important: isImportant,
        is_overdue: deadline ? deadline.getTime() < now.getTime() : false,
        days_until_deadline: daysUntilDeadline,
      };

      if (isUrgent && isImportant) {
        quadrants.do_first.push(task);
      } else if (!isUrgent && isImportant) {
        quadrants.schedule.push(task);
      } else if (isUrgent && !isImportant) {
        quadrants.delegate.push(task);
      } else {
        quadrants.eliminate.push(task);
      }
    }

    const totalTasks = result.recordset.length;

    return res.json({
      quadrants,
      summary: {
        total: totalTasks,
        do_first: quadrants.do_first.length,
        schedule: quadrants.schedule.length,
        delegate: quadrants.delegate.length,
        eliminate: quadrants.eliminate.length,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi phân loại Eisenhower." });
  }
});

// ── Tasks Over Time API ──────────────────────────────────────────────
app.get("/analytics/tasks-over-time", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Thiếu access token." });
    let decoded;
    try { decoded = verifyAccessToken(token); } catch { return res.status(401).json({ error: "Access token không hợp lệ." }); }
    if (!decoded) return res.status(401).json({ error: "Access token không hợp lệ." });

    const ma_nhan_vien = String(decoded.sub);
    const pool = await poolPromise;
    const months = Math.min(Math.max(parseInt(req.query.months) || 12, 3), 24);

    // 1. Tasks created per month
    const createdQuery = await pool.request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .input("months", sql.Int, months)
      .query(
        `SELECT
           FORMAT(cv.ngay_tao, 'yyyy-MM') AS month_key,
           YEAR(cv.ngay_tao) AS yr,
           MONTH(cv.ngay_tao) AS mo,
           COUNT(*) AS total
         FROM dbo.cong_viec cv
         INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
         WHERE pt.ma_nhan_vien = @ma_nhan_vien
           AND cv.ngay_tao IS NOT NULL
           AND cv.ngay_tao >= DATEADD(MONTH, -@months, GETDATE())
           AND (cv.trang_thai_cong_viec IS NULL OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa'))
         GROUP BY FORMAT(cv.ngay_tao, 'yyyy-MM'), YEAR(cv.ngay_tao), MONTH(cv.ngay_tao)
         ORDER BY yr, mo`
      );

    // 2. Tasks completed per month (based on ngay_cap_nhat when status = done)
    const completedQuery = await pool.request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .input("months", sql.Int, months)
      .query(
        `SELECT
           FORMAT(cv.ngay_cap_nhat, 'yyyy-MM') AS month_key,
           YEAR(cv.ngay_cap_nhat) AS yr,
           MONTH(cv.ngay_cap_nhat) AS mo,
           COUNT(*) AS total
         FROM dbo.cong_viec cv
         INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
         WHERE pt.ma_nhan_vien = @ma_nhan_vien
           AND cv.trang_thai_cong_viec IN (N'Hoàn thành', N'Đã hoàn thành')
           AND cv.ngay_cap_nhat IS NOT NULL
           AND cv.ngay_cap_nhat >= DATEADD(MONTH, -@months, GETDATE())
         GROUP BY FORMAT(cv.ngay_cap_nhat, 'yyyy-MM'), YEAR(cv.ngay_cap_nhat), MONTH(cv.ngay_cap_nhat)
         ORDER BY yr, mo`
      );

    // 3. Tasks overdue per month (based on han_hoan_thanh)
    const overdueQuery = await pool.request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .input("months", sql.Int, months)
      .query(
        `SELECT
           FORMAT(cv.han_hoan_thanh, 'yyyy-MM') AS month_key,
           YEAR(cv.han_hoan_thanh) AS yr,
           MONTH(cv.han_hoan_thanh) AS mo,
           COUNT(*) AS total
         FROM dbo.cong_viec cv
         INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
         WHERE pt.ma_nhan_vien = @ma_nhan_vien
           AND cv.han_hoan_thanh < GETDATE()
           AND cv.trang_thai_cong_viec NOT IN (N'Hoàn thành', N'Đã hoàn thành', N'Đã bị xóa', N'Đã xóa')
           AND cv.han_hoan_thanh IS NOT NULL
           AND cv.han_hoan_thanh >= DATEADD(MONTH, -@months, GETDATE())
         GROUP BY FORMAT(cv.han_hoan_thanh, 'yyyy-MM'), YEAR(cv.han_hoan_thanh), MONTH(cv.han_hoan_thanh)
         ORDER BY yr, mo`
      );

    // Build a unified month list
    const now = new Date();
    const monthLabels = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `T${d.getMonth() + 1}/${d.getFullYear()}`;
      monthLabels.push({ key, label });
    }

    const createdMap = {};
    for (const r of createdQuery.recordset) createdMap[r.month_key] = r.total;
    const completedMap = {};
    for (const r of completedQuery.recordset) completedMap[r.month_key] = r.total;
    const overdueMap = {};
    for (const r of overdueQuery.recordset) overdueMap[r.month_key] = r.total;

    const timeline = monthLabels.map((m) => ({
      month_key: m.key,
      label: m.label,
      created: createdMap[m.key] || 0,
      completed: completedMap[m.key] || 0,
      overdue: overdueMap[m.key] || 0,
    }));

    // 4. Status summary totals
    const statusSummary = await pool.request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT
           SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Cần thực hiện') OR cv.trang_thai_cong_viec IS NULL THEN 1 ELSE 0 END) AS todo,
           SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Đang thực hiện') THEN 1 ELSE 0 END) AS in_progress,
           SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Hoàn thành', N'Đã hoàn thành') THEN 1 ELSE 0 END) AS done,
           COUNT(*) AS total
         FROM dbo.cong_viec cv
         INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
         WHERE pt.ma_nhan_vien = @ma_nhan_vien
           AND (cv.trang_thai_cong_viec IS NULL OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa'))`
      );

    const summary = statusSummary.recordset[0] || { todo: 0, in_progress: 0, done: 0, total: 0 };

    // 5. Tasks by priority
    const priorityQuery = await pool.request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT
           ISNULL(cv.do_uu_tien, N'Không xác định') AS priority,
           COUNT(*) AS total
         FROM dbo.cong_viec cv
         INNER JOIN dbo.phu_trach pt ON pt.ma_cong_viec = cv.ma_cong_viec
         WHERE pt.ma_nhan_vien = @ma_nhan_vien
           AND (cv.trang_thai_cong_viec IS NULL OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa'))
         GROUP BY ISNULL(cv.do_uu_tien, N'Không xác định')
         ORDER BY total DESC`
      );

    const by_priority = priorityQuery.recordset.map((r) => ({
      priority: r.priority,
      count: r.total,
    }));

    return res.json({ timeline, summary, by_priority, months });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi lấy dữ liệu thống kê theo thời gian." });
  }
});

// ── Tasks By Assignee API ────────────────────────────────────────────
app.get("/analytics/tasks-by-assignee", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Thiếu access token." });
    let decoded;
    try { decoded = verifyAccessToken(token); } catch { return res.status(401).json({ error: "Access token không hợp lệ." }); }
    if (!decoded) return res.status(401).json({ error: "Access token không hợp lệ." });

    const ma_nhan_vien = String(decoded.sub);
    const pool = await poolPromise;

    // 1. Per-assignee summary: total, completed, in_progress, todo, overdue
    const assigneeQuery = await pool.request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT
           nv.ma_nhan_vien,
           nv.ten_nv,
           COUNT(cv.ma_cong_viec) AS total,
           SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Hoàn thành', N'Đã hoàn thành') THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Đang thực hiện') THEN 1 ELSE 0 END) AS in_progress,
           SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Cần thực hiện') OR cv.trang_thai_cong_viec IS NULL THEN 1 ELSE 0 END) AS todo,
           SUM(CASE WHEN cv.han_hoan_thanh < GETDATE()
                      AND cv.trang_thai_cong_viec NOT IN (N'Hoàn thành', N'Đã hoàn thành')
                      THEN 1 ELSE 0 END) AS overdue
         FROM dbo.phu_trach pt
         INNER JOIN dbo.cong_viec cv ON cv.ma_cong_viec = pt.ma_cong_viec
         INNER JOIN dbo.nhan_vien nv ON nv.ma_nhan_vien = pt.ma_nhan_vien
         WHERE cv.ma_cong_viec IN (
           SELECT cv2.ma_cong_viec FROM dbo.cong_viec cv2
           INNER JOIN dbo.phu_trach pt2 ON pt2.ma_cong_viec = cv2.ma_cong_viec
           WHERE pt2.ma_nhan_vien = @ma_nhan_vien
         )
         AND (cv.trang_thai_cong_viec IS NULL OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa'))
         GROUP BY nv.ma_nhan_vien, nv.ten_nv
         ORDER BY total DESC`
      );

    const assignees = assigneeQuery.recordset.map((r) => ({
      id: r.ma_nhan_vien,
      name: r.ten_nv || r.ma_nhan_vien,
      total: r.total,
      completed: r.completed,
      in_progress: r.in_progress,
      todo: r.todo,
      overdue: r.overdue,
      completion_rate: r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
    }));

    // 2. Per-assignee by priority
    const priorityQuery = await pool.request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT
           nv.ma_nhan_vien,
           nv.ten_nv,
           ISNULL(cv.do_uu_tien, N'Không xác định') AS priority,
           COUNT(*) AS total
         FROM dbo.phu_trach pt
         INNER JOIN dbo.cong_viec cv ON cv.ma_cong_viec = pt.ma_cong_viec
         INNER JOIN dbo.nhan_vien nv ON nv.ma_nhan_vien = pt.ma_nhan_vien
         WHERE cv.ma_cong_viec IN (
           SELECT cv2.ma_cong_viec FROM dbo.cong_viec cv2
           INNER JOIN dbo.phu_trach pt2 ON pt2.ma_cong_viec = cv2.ma_cong_viec
           WHERE pt2.ma_nhan_vien = @ma_nhan_vien
         )
         AND (cv.trang_thai_cong_viec IS NULL OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa'))
         GROUP BY nv.ma_nhan_vien, nv.ten_nv, ISNULL(cv.do_uu_tien, N'Không xác định')
         ORDER BY nv.ten_nv, total DESC`
      );

    // Build per-person priority map
    const priorityMap = {};
    for (const r of priorityQuery.recordset) {
      if (!priorityMap[r.ma_nhan_vien]) priorityMap[r.ma_nhan_vien] = [];
      priorityMap[r.ma_nhan_vien].push({ priority: r.priority, count: r.total });
    }

    // Add priority breakdown to each assignee
    const assigneesWithPriority = assignees.map((a) => ({
      ...a,
      by_priority: priorityMap[a.id] || [],
    }));

    // 3. Overall totals
    const totalTasks = assignees.reduce((s, a) => s + a.total, 0);
    const totalCompleted = assignees.reduce((s, a) => s + a.completed, 0);
    const totalOverdue = assignees.reduce((s, a) => s + a.overdue, 0);

    return res.json({
      assignees: assigneesWithPriority,
      summary: {
        total_members: assignees.length,
        total_tasks: totalTasks,
        total_completed: totalCompleted,
        total_overdue: totalOverdue,
        avg_tasks_per_member: assignees.length > 0 ? Math.round(totalTasks / assignees.length * 10) / 10 : 0,
        avg_completion_rate: assignees.length > 0 ? Math.round(assignees.reduce((s, a) => s + a.completion_rate, 0) / assignees.length) : 0,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi lấy dữ liệu theo người thực hiện." });
  }
});

// ── Tasks By Related Person API ──────────────────────────────────────
app.get("/analytics/tasks-by-related", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Thiếu access token." });
    let decoded;
    try { decoded = verifyAccessToken(token); } catch { return res.status(401).json({ error: "Access token không hợp lệ." }); }
    if (!decoded) return res.status(401).json({ error: "Access token không hợp lệ." });

    const ma_nhan_vien = String(decoded.sub);
    const pool = await poolPromise;

    // 1. Per related-member summary: tasks they are related to (via thanh_vien_nhom)
    const relatedQuery = await pool.request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT
           nv.ma_nhan_vien,
           nv.ten_nv,
           tvn.vai_tro,
           COUNT(DISTINCT cv.ma_cong_viec) AS total,
           SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Hoàn thành', N'Đã hoàn thành') THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Đang thực hiện') THEN 1 ELSE 0 END) AS in_progress,
           SUM(CASE WHEN cv.trang_thai_cong_viec IN (N'Cần thực hiện') OR cv.trang_thai_cong_viec IS NULL THEN 1 ELSE 0 END) AS todo,
           SUM(CASE WHEN cv.han_hoan_thanh < GETDATE()
                      AND cv.trang_thai_cong_viec NOT IN (N'Hoàn thành', N'Đã hoàn thành')
                      THEN 1 ELSE 0 END) AS overdue
         FROM dbo.thanh_vien_nhom tvn
         INNER JOIN dbo.du_an da ON da.ma_nhom = tvn.ma_nhom
         INNER JOIN dbo.cong_viec cv ON cv.ma_du_an = da.ma_du_an
         INNER JOIN dbo.nhan_vien nv ON nv.ma_nhan_vien = tvn.ma_nhan_vien
         WHERE da.ma_du_an IN (
           SELECT da2.ma_du_an FROM dbo.du_an da2
           INNER JOIN dbo.thanh_vien_nhom tvn2 ON tvn2.ma_nhom = da2.ma_nhom
           WHERE tvn2.ma_nhan_vien = @ma_nhan_vien
         )
         AND (cv.trang_thai_cong_viec IS NULL OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa'))
         GROUP BY nv.ma_nhan_vien, nv.ten_nv, tvn.vai_tro
         ORDER BY total DESC`
      );

    const members = relatedQuery.recordset.map((r) => ({
      id: r.ma_nhan_vien,
      name: r.ten_nv || r.ma_nhan_vien,
      role: r.vai_tro || "Thành viên",
      total: r.total,
      completed: r.completed,
      in_progress: r.in_progress,
      todo: r.todo,
      overdue: r.overdue,
      completion_rate: r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
    }));

    // 2. Per-member by priority
    const priorityQuery = await pool.request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT
           nv.ma_nhan_vien,
           ISNULL(cv.do_uu_tien, N'Không xác định') AS priority,
           COUNT(DISTINCT cv.ma_cong_viec) AS total
         FROM dbo.thanh_vien_nhom tvn
         INNER JOIN dbo.du_an da ON da.ma_nhom = tvn.ma_nhom
         INNER JOIN dbo.cong_viec cv ON cv.ma_du_an = da.ma_du_an
         INNER JOIN dbo.nhan_vien nv ON nv.ma_nhan_vien = tvn.ma_nhan_vien
         WHERE da.ma_du_an IN (
           SELECT da2.ma_du_an FROM dbo.du_an da2
           INNER JOIN dbo.thanh_vien_nhom tvn2 ON tvn2.ma_nhom = da2.ma_nhom
           WHERE tvn2.ma_nhan_vien = @ma_nhan_vien
         )
         AND (cv.trang_thai_cong_viec IS NULL OR cv.trang_thai_cong_viec NOT IN (N'Đã bị xóa', N'Đã xóa'))
         GROUP BY nv.ma_nhan_vien, ISNULL(cv.do_uu_tien, N'Không xác định')
         ORDER BY nv.ma_nhan_vien, total DESC`
      );

    const priorityMap = {};
    for (const r of priorityQuery.recordset) {
      if (!priorityMap[r.ma_nhan_vien]) priorityMap[r.ma_nhan_vien] = [];
      priorityMap[r.ma_nhan_vien].push({ priority: r.priority, count: r.total });
    }

    const membersWithPriority = members.map((m) => ({
      ...m,
      by_priority: priorityMap[m.id] || [],
    }));

    // 3. Role distribution
    const roleMap = {};
    for (const m of members) {
      if (!roleMap[m.role]) {
        roleMap[m.role] = { count: 0, members: [] };
      }
      roleMap[m.role].count++;
      roleMap[m.role].members.push({ id: m.id, name: m.name });
    }
    const by_role = Object.entries(roleMap).map(([role, data]) => ({
      role,
      count: data.count,
      members: data.members
    }));

    // 4. Overall totals
    const totalTasks = members.reduce((s, m) => s + m.total, 0);
    const totalCompleted = members.reduce((s, m) => s + m.completed, 0);
    const totalOverdue = members.reduce((s, m) => s + m.overdue, 0);

    return res.json({
      members: membersWithPriority,
      by_role,
      summary: {
        total_members: members.length,
        total_tasks: totalTasks,
        total_completed: totalCompleted,
        total_overdue: totalOverdue,
        avg_tasks_per_member: members.length > 0 ? Math.round(totalTasks / members.length * 10) / 10 : 0,
        avg_completion_rate: members.length > 0 ? Math.round(members.reduce((s, m) => s + m.completion_rate, 0) / members.length) : 0,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi lấy dữ liệu theo người liên quan." });
  }
});

