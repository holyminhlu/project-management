# Lịch sử triển khai lại đăng nhập (SQL Server + Backend + JWT Access/Refresh)

Ngày thực hiện: 2026-03-04

## 1) Mục tiêu

- Trước đây: Frontend Next.js tự kết nối MySQL để kiểm tra tài khoản và set cookie `pm_auth` (HMAC tự tạo).
- Hiện tại: Chuyển sang mô hình **Backend Express** kết nối **SQL Server**, frontend **chỉ gọi API**.
- Nâng cao:
  - **Access Token / Refresh Token**
  - **JSON Web Token (JWT)**

Kết quả mong muốn:

- Đăng nhập trên frontend gọi `POST /api/auth/login`.
- Backend đọc bảng `nhan_vien` trong SQL Server để xác thực.
- Backend trả về JWT access + JWT refresh.
- Frontend lưu 2 token vào cookie `httpOnly`.
- Middleware bảo vệ `/home` và **tự refresh** nếu access token hết hạn/không hợp lệ nhưng refresh token còn hợp lệ.

---

## 2) Khảo sát luồng cũ

### 2.1 Frontend (cũ)

- API route: `my-app/app/api/auth/login/route.ts`
  - Kết nối MySQL (qua `my-app/lib/db.ts`)
  - Query bảng `nhan_vien`
  - Tạo cookie `pm_auth` bằng `my-app/lib/auth.ts` (HMAC, không phải JWT)

### 2.2 Backend (cũ)

- `backend/config/db.js` chỉ `sql.connect(...)` nhưng **không export pool**, trong khi `backend/server.js` lại `require({ pool, sql })` → dễ lỗi.
- Backend route `/users` đang query `Users` (không khớp schema dự án), trong khi schema thật có bảng `nhan_vien`.

### 2.3 Schema SQL Server

- File schema SQL Server: `schema2.sql`
- Bảng đăng nhập: `nhan_vien (email, password, trang_thai_hoat_dong, ...)`

---

## 3) Thiết kế token & chiến lược bảo mật

### 3.1 Token

- **Access Token (JWT, HS256)**
  - TTL mặc định: 15 phút (`ACCESS_TOKEN_TTL_SECONDS`)
  - Chứa các claim: `sub` (ma_nhan_vien), `email`, `ten_nv`, `type=access`, `iss`.

- **Refresh Token (JWT, HS256)**
  - TTL mặc định: 7 ngày (`REFRESH_TOKEN_TTL_SECONDS`)
  - Chứa claim: `sub`, `type=refresh`, `tokenId` (UUID), `iss`.
  - **Rotation**: mỗi lần refresh sẽ tạo refresh token mới và thu hồi refresh token cũ.

### 3.2 Lưu refresh token trong SQL Server

Để refresh token không phụ thuộc RAM (tránh mất khi restart backend), tạo bảng:

`dbo.auth_refresh_tokens`:

- `token_id` (UNIQUEIDENTIFIER, PK)
- `ma_nhan_vien`
- `token_hash` (VARBINARY(32)) = SHA-256 của refresh token
- `expires_at`, `revoked_at`, `replaced_by`

Backend sẽ tự chạy câu lệnh `IF OBJECT_ID(...) IS NULL CREATE TABLE ...` khi login/refresh.

Lý do hash token:

- Không lưu refresh token dạng plain text trong DB.
- Khi client gửi refresh token lên, backend hash lại và so với DB.

---

## 4) Triển khai Backend (Express + SQL Server)

### 4.1 Sửa kết nối SQL Server

File: `backend/config/db.js`

- Tạo `poolPromise = new sql.ConnectionPool(config).connect()` và export ra ngoài.
- Cho phép cấu hình qua env:
  - `DB_CONNECTION_STRING` (ưu tiên)
  - hoặc `DB_DRIVER`, `DB_SERVER`, `DB_NAME`, `DB_TRUSTED_CONNECTION`

### 4.2 Thêm JWT Access/Refresh + Endpoint

File: `backend/server.js`

Thêm:

- `POST /auth/login`
  - Query `dbo.nhan_vien` theo `email`
  - Check password (hiện đang plaintext theo data seed)
  - Issue `accessToken` + `refreshToken`
  - Insert refresh token hash vào `dbo.auth_refresh_tokens`

- `POST /auth/refresh`
  - Verify refresh JWT (`JWT_REFRESH_SECRET`)
  - Check tồn tại trong `dbo.auth_refresh_tokens`, chưa revoked, chưa expired, hash khớp
  - Rotate refresh token (insert token mới, revoke token cũ)
  - Trả về access/refresh mới

- `GET /health` để test nhanh backend.

### 4.3 Fix mapping bảng `/users`

Thay query từ `Users` → `dbo.nhan_vien`.

### 4.4 Vấn đề phát sinh: encoding `trang_thai_hoat_dong`

Khi test với driver ODBC, status trả về dạng bị lỗi: `Ho?t d?ng`.

Giải pháp:

- Đổi logic kiểm tra trạng thái sang **blacklist** (chặn các trạng thái không hoạt động như `tam_nghi`, `inactive`, `0`, `false`...), còn lại coi là active.

### 4.5 Dependency & scripts

File: `backend/package.json`

- Thêm `jsonwebtoken`.
- Thêm scripts:
  - `npm run dev` / `npm start` → `node server.js`

Lệnh cài:

```bash
cd backend
npm install
```

---

## 5) Triển khai Frontend (Next.js)

Mục tiêu: frontend **không query DB**, chỉ gọi backend.

### 5.1 Viết lại API route login

File: `my-app/app/api/auth/login/route.ts`

- Gọi backend: `POST ${BACKEND_URL}/auth/login`.
- Nếu OK, set cookie:
  - `pm_access` (httpOnly)
  - `pm_refresh` (httpOnly)
- Xoá cookie legacy `pm_auth` (maxAge=0).

ENV dùng:

- `BACKEND_URL` (mặc định `http://localhost:5000` nếu không set).

### 5.2 Thêm API route refresh (tuỳ chọn cho client)

File: `my-app/app/api/auth/refresh/route.ts`

- Lấy `pm_refresh` từ cookie.
- Gọi backend `/auth/refresh`.
- Nếu OK, set lại `pm_access` + `pm_refresh`.
- Nếu refresh fail, xoá cookies.

### 5.3 Bảo vệ route và auto refresh trong middleware

File: `my-app/middleware.ts`

- Kiểm tra `pm_access` bằng verify JWT HS256.
- Nếu access không hợp lệ/hết hạn nhưng `pm_refresh` còn:
  - Middleware gọi backend `/auth/refresh`.
  - Set cookies mới vào response rồi cho qua `/home`.
- Nếu không refresh được → redirect về `/`.

### 5.4 JWT verify trên Edge runtime

File: `my-app/lib/jwt.ts`

- Tự implement verify JWT HS256 bằng `crypto.subtle` (Edge-compatible).
- Kiểm tra signature + `exp`.

### 5.5 Loại bỏ MySQL khỏi frontend

- Xoá file `my-app/lib/db.ts`.
- Gỡ dependency `mysql2` và `dotenv` khỏi `my-app/package.json`.

Lệnh cập nhật deps:

```bash
cd my-app
npm install
```

---

## 6) Cấu hình ENV đề xuất

### 6.1 Backend `.env` (backend/.env)

Ví dụ (tuỳ máy):

```env
DB_CONNECTION_STRING=Driver={ODBC Driver 17 for SQL Server};Server=MINHLU\MINHLUSQL;Database=quanly_duan;Trusted_Connection=Yes;

JWT_ISSUER=pm-backend
JWT_SECRET=change-this-secret
# hoặc tách riêng:
# JWT_ACCESS_SECRET=...
# JWT_REFRESH_SECRET=...

ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=604800

CORS_ORIGIN=http://localhost:3000
```

### 6.2 Frontend `.env.local` (my-app/.env.local)

```env
BACKEND_URL=http://localhost:5000
JWT_SECRET=change-this-secret
# hoặc JWT_ACCESS_SECRET nếu tách riêng
```

Lưu ý: Secret ở frontend chỉ dùng để **verify access token trong middleware**. Trong production, cân nhắc:

- Không verify ở middleware (chỉ check cookie tồn tại) và để backend verify, hoặc
- Dùng public-key (RS256) để frontend verify mà không cần secret.

---

## 7) Cách chạy & test nhanh

### 7.1 Chạy backend

```bash
cd backend
npm install
node server.js
```

Test:

- `GET http://localhost:5000/health` → `{ ok: true }`
- `POST http://localhost:5000/auth/login` với body JSON `{email, password}`

### 7.2 Chạy frontend

```bash
cd my-app
npm install
npm run dev
```

Test:

- Mở `http://localhost:3000/`
- Login bằng user seed trong SQL Server (ví dụ `an@company.com / 123456`).
- Sau login, vào `/home`.
- Test refresh: sửa cookie `pm_access` thành giá trị sai (hoặc chờ hết 15 phút) rồi refresh trang `/home` → middleware sẽ tự gọi refresh.

---

## 8) Những thay đổi chính (tóm tắt)

- Backend:
  - Kết nối SQL Server bằng pool export chuẩn.
  - Thêm JWT access/refresh + refresh token rotation + lưu DB.
  - Thêm `/health`.

- Frontend:
  - `/api/auth/login` gọi backend, set cookies `pm_access`/`pm_refresh`.
  - Middleware verify JWT + auto refresh.
  - Bỏ hoàn toàn MySQL khỏi Next.js.

---

## 9) Cập nhật trang chủ: Avatar, Thông tin cá nhân, Đăng xuất

Yêu cầu:

1. Khi đăng nhập: avatar hiển thị **tên viết tắt**.
   - Ví dụ: `Nguyễn Văn An` → `NA` (lấy ký tự đầu của từ đầu và từ cuối).
2. Click avatar: hiện options
   - `Thông tin cá nhân` (hiển thị dữ liệu người dùng trong CSDL)
   - Nút `Đăng xuất` nền đỏ, chữ trắng; khi logout phải **revoke refresh token** trong SQL Server.

### 9.1 Backend: thêm endpoint profile + logout

File: `backend/server.js`

- `GET /auth/me`
  - Nhận header `Authorization: Bearer <accessToken>`
  - Verify JWT access (`JWT_ACCESS_SECRET`/`JWT_SECRET`)
  - Query bảng `dbo.nhan_vien` (join `vai_tro`, `phong_ban`) để trả thông tin cá nhân

- `POST /auth/logout`
  - Nhận `{ refreshToken }`
  - Verify refresh JWT (`JWT_REFRESH_SECRET`/`JWT_SECRET`)
  - Hash refresh token (SHA-256) và so với `dbo.auth_refresh_tokens.token_hash`
  - Nếu khớp: set `revoked_at = SYSUTCDATETIME()` để thu hồi refresh token

### 9.2 Frontend: API routes trung gian

Mục tiêu: client không gọi thẳng backend, chỉ gọi Next API.

- `GET /api/auth/me`
  - Lấy `pm_access` từ cookie httpOnly
  - Gọi backend `GET /auth/me` kèm bearer token
  - Trả dữ liệu `user` về cho UI

- `POST /api/auth/logout`
  - Lấy `pm_refresh` từ cookie httpOnly
  - Gọi backend `POST /auth/logout` để revoke refresh token
  - Xoá cookies: `pm_access`, `pm_refresh`, `pm_auth`

### 9.3 UI trang chủ

File: `my-app/app/home/page.tsx`

- Đọc cookie `pm_access` (server-side), verify access JWT và lấy claim `ten_nv`.
- Tính initials và render component avatar.

File: `my-app/app/home/AvatarMenu.tsx`

- Click avatar → mở dropdown.
- Click `Thông tin cá nhân` → chuyển sang trang `/profile`.
- Click `Đăng xuất` → gọi `/api/auth/logout`, sau đó redirect về `/`.

File: `my-app/app/profile/page.tsx`

- Trang **màn hình trắng** hiển thị thông tin cá nhân.
- Server component đọc cookie `pm_access` và gọi backend `GET /auth/me` (Bearer access token) để render dữ liệu.

File: `my-app/middleware.ts`

- Bảo vệ thêm route `/profile` tương tự `/home` (verify access, tự refresh nếu cần).

File: `my-app/app/globals.css`

- Thêm style cho dropdown.
- Nút logout dùng `var(--accent2)` (đỏ) và chữ trắng.
