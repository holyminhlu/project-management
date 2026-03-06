use quanly_duan
-- ========================
-- 1. BẢNG VAI TRÒ
-- ========================
INSERT INTO vai_tro VALUES
('VT01', N'Quản trị hệ thống'),
('VT02', N'Trưởng phòng'),
('VT03', N'Trưởng nhóm'),
('VT04', N'Nhân viên'),
('VT05', N'Thực tập sinh');

-- ========================
-- 2. BẢNG PHÒNG BAN
-- ========================
INSERT INTO phong_ban (ma_phong_ban, ten_phong_ban) VALUES
('PB01', N'Phòng Công nghệ thông tin'),
('PB02', N'Phòng Marketing'),
('PB03', N'Phòng Nhân sự'),
('PB04', N'Phòng Tài chính'),
('PB05', N'Phòng Kinh doanh');

-- ========================
-- 3. BẢNG NHÂN VIÊN
-- ========================
INSERT INTO nhan_vien 
(ma_nhan_vien, ma_vai_tro, ma_phong_ban, ten_nv, email, password, trang_thai_hoat_dong)
VALUES
('NV01','VT01','PB01',N'Nguyễn Văn An','an@company.com','123456',N'Hoạt động'),
('NV02','VT02','PB01',N'Trần Thị Bình','binh@company.com','123456',N'Hoạt động'),
('NV03','VT03','PB02',N'Lê Hoàng Nam','nam@company.com','123456',N'Hoạt động'),
('NV04','VT04','PB02',N'Phạm Minh Tuấn','tuan@company.com','123456',N'Hoạt động'),
('NV05','VT04','PB03',N'Đỗ Thị Lan','lan@company.com','123456',N'Tạm nghỉ'),
('NV06','VT05','PB01',N'Ngô Quốc Huy','huy@company.com','123456',N'Hoạt động'),
('NV07','VT04','PB04',N'Võ Thanh Tùng','tung@company.com','123456',N'Hoạt động');

-- ========================
-- 4. BẢNG NHÓM
-- ========================
INSERT INTO nhom_nhan_vien
(ma_nhom, ten_nhom, thong_tin, nguoi_dung_nhom)
VALUES
('N01',N'Nhóm Backend',N'Phát triển hệ thống API','NV03'),
('N02',N'Nhóm Frontend',N'Phát triển giao diện người dùng','NV04'),
('N03',N'Nhóm Marketing Online',N'Quảng bá sản phẩm','NV03'),
('N04',N'Nhóm Tuyển dụng',N'Tuyển dụng nhân sự mới','NV05'),
('N05',N'Nhóm Kế toán',N'Quản lý tài chính','NV07');

-- ========================
-- 5. BẢNG THÀNH VIÊN NHÓM
-- ========================
INSERT INTO thanh_vien_nhom (ma_nhan_vien, ma_nhom, vai_tro) VALUES
('NV03','N01',N'Trưởng nhóm'),
('NV01','N01',N'Thành viên'),
('NV06','N01',N'Thành viên'),
('NV04','N02',N'Trưởng nhóm'),
('NV03','N03',N'Trưởng nhóm'),
('NV05','N04',N'Trưởng nhóm'),
('NV07','N05',N'Trưởng nhóm');

-- ========================
-- 6. BẢNG DỰ ÁN
-- ========================
INSERT INTO du_an
(ma_du_an, ma_nhom, ma_phong_ban, ten_du_an, mo_ta, trang_thai_du_an, ngay_bat_dau, ngay_ket_thuc)
VALUES
('DA01','N01','PB01',N'Hệ thống quản lý bán hàng',N'Xây dựng phần mềm quản lý bán hàng',N'Đang thực hiện','2025-01-01','2025-06-30'),
('DA02','N02','PB01',N'Website công ty',N'Thiết kế website chính thức',N'Hoàn thành','2024-05-01','2024-10-01'),
('DA03','N03','PB02',N'Chiến dịch quảng cáo Tết',N'Quảng bá sản phẩm dịp Tết',N'Đang thực hiện','2025-12-01','2026-02-01'),
('DA04','N04','PB03',N'Tuyển dụng Q1',N'Tuyển dụng nhân sự quý 1',N'Hoàn thành','2025-01-01','2025-03-31'),
('DA05','N05','PB04',N'Kiểm toán nội bộ',N'Kiểm toán tài chính nội bộ',N'Chưa bắt đầu','2025-07-01','2025-09-01');


INSERT INTO du_an
(ma_du_an, ma_nhom, ma_phong_ban, ten_du_an, mo_ta, trang_thai_du_an, ngay_bat_dau, ngay_ket_thuc)
VALUES
('DA06','N01','PB01',N'Hệ thống quản lý máy in',N'Xây dựng phần mềm quản lý máy in',N'Đã bị gỡ','2025-01-01','2025-06-30'),
('DA07','N02','PB01',N'Website phân công công việc',N'Thiết kế website chính thức',N'Đã bị gỡ','2024-02-01','2025-10-01');
-- ========================
-- 7. BẢNG CÔNG VIỆC
-- ========================
INSERT INTO cong_viec
(ma_cong_viec, ma_du_an, tieu_de, mo_ta, trang_thai_cong_viec, do_uu_tien, han_hoan_thanh)
VALUES
('CV01','DA01',N'Thiết kế CSDL',N'Thiết kế database hệ thống',N'Đang thực hiện',N'Cao','2025-03-01'),
('CV02','DA01',N'Xây dựng API',N'Code API backend',N'Cần thực hiện',N'Cao','2025-04-01'),
('CV03','DA02',N'Thiết kế giao diện',N'UI/UX website',N'Hoàn thành',N'Trung bình','2024-07-01'),
('CV04','DA03',N'Chạy quảng cáo Facebook',N'Thiết lập chiến dịch ads',N'Đang thực hiện',N'Cao','2025-12-20'),
('CV05','DA04',N'Đăng tin tuyển dụng',N'Đăng tin lên các nền tảng',N'Hoàn thành',N'Thấp','2025-01-15'),

('CV06','DA01',N'Thiết kế Giao diện',N'Thiết kế giao diện bằng React',N'Đang thực hiện',N'Cao','2025-03-01'),
('CV07','DA01',N'Bảo mật tài khoản',N'Thêm các cơ chế bảo mật',N'Cần thực hiện',N'Cao','2025-04-01'),
('CV08','DA01',N'Phân quyền người dùng',N'Phân quyền người dùng trên hệ thống',N'Cần thực hiện',N'Cao','2025-03-01'),
('CV09','DA01',N'Phát thảo Wireframe',N'Phát thảo giao diện trên Figma',N'Đã hoàn thành',N'Cao','2025-04-01');

-- ========================
-- 8. BẢNG PHỤ TRÁCH
-- ========================
INSERT INTO phu_trach VALUES
('CV06','NV01'),
('CV07','NV01'),
('CV08','NV01'),
('CV09','NV01'),

('CV03','NV01'),
('CV04','NV01'),
('CV05','NV01'),
('CV02','NV01'),
('CV01','NV01'),
('CV02','NV03'),
('CV03','NV04'),
('CV04','NV03'),
('CV05','NV05');

-- ========================
-- 9. BẢNG BÌNH LUẬN CÔNG VIỆC
-- ========================
INSERT INTO binh_luan_cong_viec (ma_nhan_vien, ma_cong_viec, noi_dung) VALUES
('NV01','CV01',N'Đã hoàn thành thiết kế sơ bộ'),
('NV03','CV02',N'Đang xây dựng API phần đăng nhập'),
('NV04','CV03',N'Giao diện đã được duyệt'),
('NV03','CV04',N'Chiến dịch đang chạy ổn định'),
('NV05','CV05',N'Đã nhận được 20 hồ sơ');

-- ========================
-- 10. BẢNG NHẮC NHỞ
-- ========================
INSERT INTO nhac_nho VALUES
('NN01','NV01',N'Hoàn thành CSDL trước hạn','2025-02-28',GETDATE()),
('NN02','NV03',N'Họp nhóm Backend','2025-03-05',GETDATE()),
('NN03','NV04',N'Cập nhật giao diện mới','2024-06-15',GETDATE()),
('NN04','NV05',N'Kiểm tra hồ sơ ứng viên','2025-01-10',GETDATE()),
('NN05','NV07',N'Báo cáo tài chính tháng','2025-03-30',GETDATE());

-- ========================
-- 11. BẢNG BÁO CÁO
-- ========================
INSERT INTO bao_cao (ma_bao_cao, ma_cong_viec, tieu_de, noi_dung)
VALUES
('BC01','CV01',N'Báo cáo tiến độ CSDL',N'Đã hoàn thành 80%'),
('BC02','CV02',N'Báo cáo API',N'Hoàn thành chức năng đăng nhập'),
('BC03','CV03',N'Báo cáo giao diện',N'Đã deploy production'),
('BC04','CV04',N'Báo cáo quảng cáo',N'Đạt 10.000 lượt tiếp cận'),
('BC05','CV05',N'Báo cáo tuyển dụng',N'Đã tuyển được 2 nhân sự');

-- ========================
-- 12. BẢNG TẠO BÁO CÁO
-- ========================
INSERT INTO tao_bao_cao VALUES
('BC01','NV01'),
('BC02','NV03'),
('BC03','NV04'),
('BC04','NV03'),
('BC05','NV05');


use quanly_duan
-- ========================
-- 1. BẢNG VAI TRÒ
-- ========================
INSERT INTO vai_tro VALUES
('VT01', N'Quản trị hệ thống'),
('VT02', N'Trưởng phòng'),
('VT03', N'Trưởng nhóm'),
('VT04', N'Nhân viên'),
('VT05', N'Thực tập sinh');

-- ========================
-- 2. BẢNG PHÒNG BAN
-- ========================
INSERT INTO phong_ban (ma_phong_ban, ten_phong_ban) VALUES
('PB01', N'Phòng Công nghệ thông tin'),
('PB02', N'Phòng Marketing'),
('PB03', N'Phòng Nhân sự'),
('PB04', N'Phòng Tài chính'),
('PB05', N'Phòng Kinh doanh');

-- ========================
-- 3. BẢNG NHÂN VIÊN
-- ========================
INSERT INTO nhan_vien 
(ma_nhan_vien, ma_vai_tro, ma_phong_ban, ten_nv, email, password, trang_thai_hoat_dong)
VALUES
('NV08','VT04','PB01',N'Nguyễn Văn Sinh','sinh@company.com','123456',N'Hoạt động'),
('NV09','VT04','PB01',N'Trần Thị Ngọ','ngo@company.com','123456',N'Hoạt động'),
('NV10','VT04','PB01',N'Lê Hoàng Huy','hhuy@company.com','123456',N'Hoạt động'),
('NV11','VT04','PB01',N'Phạm Minh Mẫn','man@company.com','123456',N'Hoạt động'),
('NV12','VT04','PB01',N'Đỗ Thị Quế','que@company.com','123456',N'Tạm nghỉ'),
('NV13','VT04','PB02',N'Ngô Quốc Việt','viet@company.com','123456',N'Hoạt động'),
('NV14','VT04','PB02',N'Võ Thanh Thưởng','thuong@company.com','123456',N'Hoạt động'),
('NV15','VT04','PB02',N'Nguyễn Hoài Nam','hnam@company.com','123456',N'Hoạt động'),
('NV16','VT04','PB02',N'Trần Thị Khiêm','khiem@company.com','123456',N'Hoạt động'),
('NV17','VT04','PB02',N'Lê Hoàng Minh Nhật','nhat@company.com','123456',N'Hoạt động'),
('NV18','VT04','PB03',N'Phạm Tấn Mãi','mai@company.com','123456',N'Hoạt động'),
('NV19','VT04','PB03',N'Đỗ Quế Minh','minh@company.com','123456',N'Tạm nghỉ'),
('NV20','VT04','PB03',N'Ngô Thanh Thanh','thanh@company.com','123456',N'Hoạt động'),
('NV21','VT04','PB03',N'Võ Thanh Nhật','tnhat@company.com','123456',N'Hoạt động'),
('NV22','VT04','PB03',N'Trần Thị Mai Minh','mminh@company.com','123456',N'Hoạt động'),
('NV23','VT04','PB04',N'Lê Minh Mẫn','mman@company.com','123456',N'Hoạt động'),
('NV24','VT04','PB04',N'Phạm Phước Toàn','toan@company.com','123456',N'Hoạt động'),
('NV25','VT04','PB04',N'Đỗ Thị Lan Hương','huong@company.com','123456',N'Tạm nghỉ'),
('NV26','VT04','PB04',N'Ngô Thanh Ngân','ngan@company.com','123456',N'Hoạt động'),
('NV27','VT04','PB04',N'Võ Hoàng Tất','tat@company.com','123456',N'Hoạt động');