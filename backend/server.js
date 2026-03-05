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

