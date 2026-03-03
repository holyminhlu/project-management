CREATE TABLE vai_tro (
    ma_vai_tro VARCHAR(25) PRIMARY KEY,
    ten_vai_tro VARCHAR(50)
) ENGINE=InnoDB;
CREATE TABLE phong_ban (
    ma_phong_ban VARCHAR(25) PRIMARY KEY,
    ten_phong_ban VARCHAR(100),
    ngay_tao_phong_ban DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE nhan_vien (
    ma_nhan_vien VARCHAR(25) PRIMARY KEY,
    ma_vai_tro VARCHAR(25),
    ma_phong_ban VARCHAR(25),
    ten_nv VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    trang_thai_hoat_dong VARCHAR(20),
    ngay_tao_nhan_vien DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ma_vai_tro) REFERENCES vai_tro(ma_vai_tro),
    FOREIGN KEY (ma_phong_ban) REFERENCES phong_ban(ma_phong_ban)
) ENGINE=InnoDB;
CREATE TABLE nhom (
    ma_nhom VARCHAR(25) PRIMARY KEY,
    ten_nhom VARCHAR(100),
    thong_tin TEXT,
    nguoi_dung_nhom VARCHAR(25),
    ngay_tao_nhom DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (nguoi_dung_nhom) REFERENCES nhan_vien(ma_nhan_vien)
) ENGINE=InnoDB;
CREATE TABLE thanh_vien_nhom (
    ma_nhan_vien VARCHAR(25),
    ma_nhom VARCHAR(25),
    vai_tro VARCHAR(50),
    ngay_tham_gia DATETIME DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (ma_nhan_vien, ma_nhom),
    FOREIGN KEY (ma_nhan_vien) REFERENCES nhan_vien(ma_nhan_vien),
    FOREIGN KEY (ma_nhom) REFERENCES nhom(ma_nhom)
) ENGINE=InnoDB;
CREATE TABLE du_an (
    ma_du_an VARCHAR(25) PRIMARY KEY,
    ma_nhom VARCHAR(25),
    ma_phong_ban VARCHAR(25),
    ten_du_an VARCHAR(150),
    mo_ta TEXT,
    ngay_bat_dau DATETIME,
    ngay_ket_thuc DATETIME,
    ngay_tao_du_an DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ma_nhom) REFERENCES nhom(ma_nhom),
    FOREIGN KEY (ma_phong_ban) REFERENCES phong_ban(ma_phong_ban)
) ENGINE=InnoDB;
CREATE TABLE trang_thai_du_an (
    ma_trang_thai VARCHAR(25) PRIMARY KEY,
    ten_trang_thai VARCHAR(50)
) ENGINE=InnoDB;
CREATE TABLE to_chuc (
    ma_trang_thai VARCHAR(25),
    ma_du_an VARCHAR(25),

    PRIMARY KEY (ma_trang_thai, ma_du_an),
    FOREIGN KEY (ma_trang_thai) REFERENCES trang_thai_du_an(ma_trang_thai),
    FOREIGN KEY (ma_du_an) REFERENCES du_an(ma_du_an)
) ENGINE=InnoDB;
CREATE TABLE trang_thai_cong_viec (
    ma_trang_thai VARCHAR(25) PRIMARY KEY,
    ten_trang_thai VARCHAR(50)
) ENGINE=InnoDB;
CREATE TABLE cong_viec (
    ma_cong_viec VARCHAR(25) PRIMARY KEY,
    ma_trang_thai VARCHAR(25),
    ma_du_an VARCHAR(25),
    tieu_de VARCHAR(150),
    mo_ta TEXT,
    do_uu_tien VARCHAR(25),
    ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
    han_hoan_thanh DATETIME,
    ngay_cap_nhat DATETIME ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (ma_trang_thai) REFERENCES trang_thai_cong_viec(ma_trang_thai),
    FOREIGN KEY (ma_du_an) REFERENCES du_an(ma_du_an)
) ENGINE=InnoDB;
CREATE TABLE phu_trach (
    ma_cong_viec VARCHAR(25),
    ma_nhan_vien VARCHAR(25),

    PRIMARY KEY (ma_cong_viec, ma_nhan_vien),
    FOREIGN KEY (ma_cong_viec) REFERENCES cong_viec(ma_cong_viec),
    FOREIGN KEY (ma_nhan_vien) REFERENCES nhan_vien(ma_nhan_vien)
) ENGINE=InnoDB;
CREATE TABLE binh_luan_cv (
    ma_binh_luan INT AUTO_INCREMENT PRIMARY KEY,
    ma_nhan_vien VARCHAR(25),
    ma_cong_viec VARCHAR(25),
    noi_dung TEXT,
    ngay_binh_luan DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ma_nhan_vien) REFERENCES nhan_vien(ma_nhan_vien),
    FOREIGN KEY (ma_cong_viec) REFERENCES cong_viec(ma_cong_viec)
) ENGINE=InnoDB;
CREATE TABLE nhac_nho (
    ma_nhac_nho VARCHAR(25) PRIMARY KEY,
    ma_nhan_vien VARCHAR(25),
    noi_dung TEXT,
    thoi_gian_nhac DATETIME,
    ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ma_nhan_vien) REFERENCES nhan_vien(ma_nhan_vien)
) ENGINE=InnoDB;
CREATE TABLE bao_cao (
    ma_bao_cao VARCHAR(25) PRIMARY KEY,
    tieu_de VARCHAR(150),
    noi_dung TEXT,
    thoi_gian TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE tao (
    ma_bao_cao VARCHAR(25),
    ma_nhan_vien VARCHAR(25),

    PRIMARY KEY (ma_bao_cao, ma_nhan_vien),
    FOREIGN KEY (ma_bao_cao) REFERENCES bao_cao(ma_bao_cao),
    FOREIGN KEY (ma_nhan_vien) REFERENCES nhan_vien(ma_nhan_vien)
) ENGINE=InnoDB;nhan_vien