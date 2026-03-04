USE quanly_duan;
GO

-- 1) Ensure Vietnamese text columns use Unicode types.
ALTER TABLE dbo.vai_tro ALTER COLUMN ten_vai_tro NVARCHAR(50) NULL;
ALTER TABLE dbo.phong_ban ALTER COLUMN ten_phong_ban NVARCHAR(100) NULL;
ALTER TABLE dbo.nhan_vien ALTER COLUMN ten_nv NVARCHAR(100) NULL;
ALTER TABLE dbo.nhan_vien ALTER COLUMN trang_thai_hoat_dong NVARCHAR(20) NULL;
GO

-- 2) Re-seed display text for rows commonly shown in UI.
UPDATE dbo.vai_tro
SET ten_vai_tro = CASE ma_vai_tro
  WHEN 'VT01' THEN N'Quản trị hệ thống'
  WHEN 'VT02' THEN N'Trưởng phòng'
  WHEN 'VT03' THEN N'Trưởng nhóm'
  WHEN 'VT04' THEN N'Nhân viên'
  WHEN 'VT05' THEN N'Thực tập sinh'
  ELSE ten_vai_tro
END
WHERE ma_vai_tro IN ('VT01', 'VT02', 'VT03', 'VT04', 'VT05');

UPDATE dbo.phong_ban
SET ten_phong_ban = CASE ma_phong_ban
  WHEN 'PB01' THEN N'Phòng Công nghệ thông tin'
  WHEN 'PB02' THEN N'Phòng Marketing'
  WHEN 'PB03' THEN N'Phòng Nhân sự'
  WHEN 'PB04' THEN N'Phòng Tài chính'
  WHEN 'PB05' THEN N'Phòng Kinh doanh'
  ELSE ten_phong_ban
END
WHERE ma_phong_ban IN ('PB01', 'PB02', 'PB03', 'PB04', 'PB05');

UPDATE dbo.nhan_vien
SET ten_nv = CASE ma_nhan_vien
  WHEN 'NV01' THEN N'Nguyễn Văn An'
  WHEN 'NV02' THEN N'Trần Thị Bình'
  WHEN 'NV03' THEN N'Lê Hoàng Nam'
  WHEN 'NV04' THEN N'Phạm Minh Tuấn'
  WHEN 'NV05' THEN N'Đỗ Thị Lan'
  WHEN 'NV06' THEN N'Ngô Quốc Huy'
  WHEN 'NV07' THEN N'Võ Thanh Tùng'
  ELSE ten_nv
END,
trang_thai_hoat_dong = CASE ma_nhan_vien
  WHEN 'NV05' THEN N'Tạm nghỉ'
  ELSE N'Hoạt động'
END
WHERE ma_nhan_vien IN ('NV01', 'NV02', 'NV03', 'NV04', 'NV05', 'NV06', 'NV07');
GO
