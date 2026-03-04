-- create database quanly_duan
use quanly_duan

-- ========================
-- BẢNG VAI TRÒ
-- ========================
CREATE TABLE vai_tro (
    ma_vai_tro VARCHAR(25) PRIMARY KEY,
    ten_vai_tro NVARCHAR(50)
);

-- ========================
-- BẢNG PHÒNG BAN
-- ========================
CREATE TABLE phong_ban (
    ma_phong_ban VARCHAR(25) PRIMARY KEY,
    ten_phong_ban NVARCHAR(100),
    ngay_tao_phong_ban DATETIME DEFAULT GETDATE()
);

-- ========================
-- BẢNG NHÂN VIÊN
-- ========================
CREATE TABLE nhan_vien (
    ma_nhan_vien VARCHAR(25) PRIMARY KEY,
    ma_vai_tro VARCHAR(25),
    ma_phong_ban VARCHAR(25),
    ten_nv NVARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    trang_thai_hoat_dong NVARCHAR(20),
    ngay_tao_nhan_vien DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (ma_vai_tro) REFERENCES vai_tro(ma_vai_tro),
    FOREIGN KEY (ma_phong_ban) REFERENCES phong_ban(ma_phong_ban)
);

-- ========================
-- BẢNG NHÓM
-- ========================
CREATE TABLE nhom_nhan_vien (
    ma_nhom VARCHAR(25) PRIMARY KEY,
    ten_nhom VARCHAR(100),
    thong_tin NVARCHAR(MAX),
    nguoi_dung_nhom VARCHAR(25),
    ngay_tao_nhom DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (nguoi_dung_nhom) REFERENCES nhan_vien(ma_nhan_vien)
);

-- ========================
-- BẢNG THÀNH VIÊN NHÓM
-- ========================
CREATE TABLE thanh_vien_nhom (
    ma_nhan_vien VARCHAR(25),
    ma_nhom VARCHAR(25),
    vai_tro VARCHAR(50),
    ngay_tham_gia DATETIME DEFAULT GETDATE(),

    PRIMARY KEY (ma_nhan_vien, ma_nhom),
    FOREIGN KEY (ma_nhan_vien) REFERENCES nhan_vien(ma_nhan_vien),
    FOREIGN KEY (ma_nhom) REFERENCES nhom_nhan_vien(ma_nhom)
);

-- ========================
-- BẢNG DỰ ÁN (ĐÃ THÊM TRẠNG THÁI)
-- ========================
CREATE TABLE du_an (
    ma_du_an VARCHAR(25) PRIMARY KEY,
    ma_nhom VARCHAR(25),
    ma_phong_ban VARCHAR(25),
    ten_du_an VARCHAR(150),
    mo_ta NVARCHAR(MAX),
    trang_thai_du_an VARCHAR(50), -- thêm trực tiếp
    ngay_bat_dau DATETIME,
    ngay_ket_thuc DATETIME,
    ngay_tao_du_an DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (ma_nhom) REFERENCES nhom_nhan_vien(ma_nhom),
    FOREIGN KEY (ma_phong_ban) REFERENCES phong_ban(ma_phong_ban)
);

-- ========================
-- BẢNG CÔNG VIỆC (ĐÃ THÊM TRẠNG THÁI)
-- ========================
CREATE TABLE cong_viec (
    ma_cong_viec VARCHAR(25) PRIMARY KEY,
    ma_du_an VARCHAR(25),
    tieu_de VARCHAR(150),
    mo_ta NVARCHAR(MAX),
    trang_thai_cong_viec VARCHAR(50), -- thêm trực tiếp
    do_uu_tien VARCHAR(25),
    ngay_tao DATETIME DEFAULT GETDATE(),
    han_hoan_thanh DATETIME,
    ngay_cap_nhat DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (ma_du_an) REFERENCES du_an(ma_du_an)
);

-- ========================
-- BẢNG PHỤ TRÁCH
-- ========================
CREATE TABLE phu_trach (
    ma_cong_viec VARCHAR(25),
    ma_nhan_vien VARCHAR(25),

    PRIMARY KEY (ma_cong_viec, ma_nhan_vien),
    FOREIGN KEY (ma_cong_viec) REFERENCES cong_viec(ma_cong_viec),
    FOREIGN KEY (ma_nhan_vien) REFERENCES nhan_vien(ma_nhan_vien)
);

-- ========================
-- BẢNG BÌNH LUẬN CÔNG VIỆC
-- ========================
CREATE TABLE binh_luan_cong_viec (
    ma_binh_luan INT IDENTITY(1,1) PRIMARY KEY,
    ma_nhan_vien VARCHAR(25),
    ma_cong_viec VARCHAR(25),
    noi_dung NVARCHAR(MAX),
    ngay_binh_luan DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (ma_nhan_vien) REFERENCES nhan_vien(ma_nhan_vien),
    FOREIGN KEY (ma_cong_viec) REFERENCES cong_viec(ma_cong_viec)
);

-- ========================
-- BẢNG NHẮC NHỞ
-- ========================
CREATE TABLE nhac_nho (
    ma_nhac_nho VARCHAR(25) PRIMARY KEY,
    ma_nhan_vien VARCHAR(25),
    noi_dung NVARCHAR(MAX),
    thoi_gian_nhac DATETIME,
    ngay_tao DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (ma_nhan_vien) REFERENCES nhan_vien(ma_nhan_vien)
);

-- ========================
-- BẢNG BÁO CÁO (THÊM LIÊN KẾT CÔNG VIỆC)
-- ========================
CREATE TABLE bao_cao (
    ma_bao_cao VARCHAR(25) PRIMARY KEY,
    ma_cong_viec VARCHAR(25), -- thêm khóa ngoại
    tieu_de VARCHAR(150),
    noi_dung NVARCHAR(MAX),
    thoi_gian DATETIME DEFAULT GETDATE(),
    ngay_tao DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (ma_cong_viec) REFERENCES cong_viec(ma_cong_viec)
);

-- ========================
-- BẢNG TẠO BÁO CÁO
-- ========================
CREATE TABLE tao_bao_cao (
    ma_bao_cao VARCHAR(25),
    ma_nhan_vien VARCHAR(25),

    PRIMARY KEY (ma_bao_cao, ma_nhan_vien),
    FOREIGN KEY (ma_bao_cao) REFERENCES bao_cao(ma_bao_cao),
    FOREIGN KEY (ma_nhan_vien) REFERENCES nhan_vien(ma_nhan_vien)
);
