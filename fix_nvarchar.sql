use quanly_duan

ALTER TABLE vai_tro
ALTER COLUMN ten_vai_tro NVARCHAR(100);

ALTER TABLE phong_ban
ALTER COLUMN ten_phong_ban NVARCHAR(200);

ALTER TABLE nhan_vien
ALTER COLUMN ten_nv NVARCHAR(150);

ALTER TABLE nhan_vien
ALTER COLUMN trang_thai_hoat_dong NVARCHAR(50);

ALTER TABLE nhom_nhan_vien
ALTER COLUMN ten_nhom NVARCHAR(150);

ALTER TABLE nhom_nhan_vien
ALTER COLUMN thong_tin NVARCHAR(300);

ALTER TABLE thanh_vien_nhom
ALTER COLUMN vai_tro NVARCHAR(100);

ALTER TABLE du_an
ALTER COLUMN ten_du_an NVARCHAR(200);

ALTER TABLE du_an
ALTER COLUMN mo_ta NVARCHAR(500);

ALTER TABLE du_an
ALTER COLUMN trang_thai_du_an NVARCHAR(100);

ALTER TABLE cong_viec
ALTER COLUMN tieu_de NVARCHAR(200);

ALTER TABLE cong_viec
ALTER COLUMN mo_ta NVARCHAR(500);

ALTER TABLE cong_viec
ALTER COLUMN trang_thai_cong_viec NVARCHAR(100);

ALTER TABLE cong_viec
ALTER COLUMN do_uu_tien NVARCHAR(50);

ALTER TABLE binh_luan_cong_viec
ALTER COLUMN noi_dung NVARCHAR(1000);

ALTER TABLE nhac_nho
ALTER COLUMN noi_dung NVARCHAR(300);

ALTER TABLE bao_cao
ALTER COLUMN tieu_de NVARCHAR(200);

ALTER TABLE bao_cao
ALTER COLUMN noi_dung NVARCHAR(1000);

USE quanly_duan;

DELETE FROM tao_bao_cao;
DELETE FROM bao_cao;
DELETE FROM nhac_nho;
DELETE FROM binh_luan_cong_viec;
DELETE FROM phu_trach;
DELETE FROM cong_viec;
DELETE FROM du_an;
DELETE FROM thanh_vien_nhom;
DELETE FROM nhom_nhan_vien;
DELETE FROM nhan_vien;
DELETE FROM phong_ban;
DELETE FROM vai_tro;

select * from cong_viec