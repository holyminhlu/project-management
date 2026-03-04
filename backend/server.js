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

function sha256Buffer(input) {
  return crypto.createHash("sha256").update(input).digest();
}

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.ma_nhan_vien,
      email: user.email,
      ten_nv: user.ten_nv,
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

function getBearerToken(req) {
  const raw = req.headers?.authorization;
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = String(value).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
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
      return res.status(401).json({ error: "Refresh token đã bị thu hồi." });
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return res.status(401).json({ error: "Refresh token đã hết hạn." });
    }

    const incomingHash = sha256Buffer(refreshToken);
    const storedHash = row.token_hash;
    if (!storedHash || !Buffer.isBuffer(storedHash) || storedHash.length !== incomingHash.length) {
      return res.status(401).json({ error: "Refresh token không hợp lệ." });
    }
    if (!crypto.timingSafeEqual(storedHash, incomingHash)) {
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
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ma_nhan_vien", sql.VarChar(25), ma_nhan_vien)
      .query(
        `SELECT
            cv.ma_cong_viec,
            cv.tieu_de,
            cv.trang_thai_cong_viec,
            cv.do_uu_tien,
            cv.han_hoan_thanh,
            da.ten_du_an
         FROM dbo.phu_trach pt
         INNER JOIN dbo.cong_viec cv ON cv.ma_cong_viec = pt.ma_cong_viec
         LEFT JOIN dbo.du_an da ON da.ma_du_an = cv.ma_du_an
         WHERE pt.ma_nhan_vien = @ma_nhan_vien
         ORDER BY
           CASE WHEN cv.han_hoan_thanh IS NULL THEN 1 ELSE 0 END,
           cv.han_hoan_thanh ASC`,
      );

    const tasks = result.recordset.map((row) => ({
      ma_cong_viec: row.ma_cong_viec,
      tieu_de: row.tieu_de,
      trang_thai_cong_viec: row.trang_thai_cong_viec || null,
      do_uu_tien: row.do_uu_tien || null,
      han_hoan_thanh: row.han_hoan_thanh || null,
      ten_du_an: row.ten_du_an || null,
      status_key: mapTaskStatusKey(row.trang_thai_cong_viec),
    }));

    return res.json({ tasks });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi máy chủ khi lấy công việc cá nhân." });
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
