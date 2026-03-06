-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 03, 2026 at 10:28 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `quanly_duan`
--

-- --------------------------------------------------------

--
-- Table structure for table `bao_cao`
--

CREATE TABLE `bao_cao` (
  `ma_bao_cao` varchar(25) NOT NULL,
  `tieu_de` varchar(150) DEFAULT NULL,
  `noi_dung` text DEFAULT NULL,
  `thoi_gian` timestamp NOT NULL DEFAULT current_timestamp(),
  `ngay_tao` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `bao_cao`
--

INSERT INTO `bao_cao` (`ma_bao_cao`, `tieu_de`, `noi_dung`, `thoi_gian`, `ngay_tao`) VALUES
('BC001', 'Báo cáo 1', 'Nội dung 1', '2026-03-03 08:57:28', '2026-03-03 15:57:28'),
('BC002', 'Báo cáo 2', 'Nội dung 2', '2026-03-03 08:57:28', '2026-03-03 15:57:28'),
('BC003', 'Báo cáo 3', 'Nội dung 3', '2026-03-03 08:57:28', '2026-03-03 15:57:28'),
('BC004', 'Báo cáo 4', 'Nội dung 4', '2026-03-03 08:57:28', '2026-03-03 15:57:28'),
('BC005', 'Báo cáo 5', 'Nội dung 5', '2026-03-03 08:57:28', '2026-03-03 15:57:28'),
('BC006', 'Báo cáo 6', 'Nội dung 6', '2026-03-03 08:57:28', '2026-03-03 15:57:28'),
('BC007', 'Báo cáo 7', 'Nội dung 7', '2026-03-03 08:57:28', '2026-03-03 15:57:28'),
('BC008', 'Báo cáo 8', 'Nội dung 8', '2026-03-03 08:57:28', '2026-03-03 15:57:28'),
('BC009', 'Báo cáo 9', 'Nội dung 9', '2026-03-03 08:57:28', '2026-03-03 15:57:28'),
('BC010', 'Báo cáo 10', 'Nội dung 10', '2026-03-03 08:57:28', '2026-03-03 15:57:28');

-- --------------------------------------------------------

--
-- Table structure for table `binh_luan_cv`
--

CREATE TABLE `binh_luan_cv` (
  `ma_binh_luan` int(11) NOT NULL,
  `ma_nhan_vien` varchar(25) DEFAULT NULL,
  `ma_cong_viec` varchar(25) DEFAULT NULL,
  `noi_dung` text DEFAULT NULL,
  `ngay_binh_luan` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `binh_luan_cv`
--

INSERT INTO `binh_luan_cv` (`ma_binh_luan`, `ma_nhan_vien`, `ma_cong_viec`, `noi_dung`, `ngay_binh_luan`) VALUES
(1, 'NV001', 'CV001', 'Hoàn thành tốt', '2026-03-03 15:56:56'),
(2, 'NV002', 'CV002', 'Cần chỉnh sửa', '2026-03-03 15:56:56'),
(3, 'NV003', 'CV003', 'Đã test xong', '2026-03-03 15:56:56'),
(4, 'NV004', 'CV004', 'Đang cập nhật', '2026-03-03 15:56:56'),
(5, 'NV005', 'CV005', 'Đã fix bug', '2026-03-03 15:56:56'),
(6, 'NV006', 'CV006', 'Server ổn định', '2026-03-03 15:56:56'),
(7, 'NV007', 'CV007', 'Yêu cầu rõ ràng', '2026-03-03 15:56:56'),
(8, 'NV008', 'CV008', 'Đã họp xong', '2026-03-03 15:56:56'),
(9, 'NV009', 'CV009', 'Phát hiện lỗi', '2026-03-03 15:56:56'),
(10, 'NV010', 'CV010', 'Deploy thành công', '2026-03-03 15:56:56');

-- --------------------------------------------------------

--
-- Table structure for table `cong_viec`
--

CREATE TABLE `cong_viec` (
  `ma_cong_viec` varchar(25) NOT NULL,
  `ma_trang_thai` varchar(25) DEFAULT NULL,
  `ma_du_an` varchar(25) DEFAULT NULL,
  `tieu_de` varchar(150) DEFAULT NULL,
  `mo_ta` text DEFAULT NULL,
  `do_uu_tien` varchar(25) DEFAULT NULL,
  `ngay_tao` datetime DEFAULT current_timestamp(),
  `han_hoan_thanh` datetime DEFAULT NULL,
  `ngay_cap_nhat` datetime DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `cong_viec`
--

INSERT INTO `cong_viec` (`ma_cong_viec`, `ma_trang_thai`, `ma_du_an`, `tieu_de`, `mo_ta`, `do_uu_tien`, `ngay_tao`, `han_hoan_thanh`, `ngay_cap_nhat`) VALUES
('CV001', 'TTCV001', 'DA001', 'Thiết kế UI', 'Thiết kế giao diện', 'Cao', '2026-03-03 15:56:30', '2025-03-01 00:00:00', NULL),
('CV002', 'TTCV002', 'DA002', 'Code Backend', 'Lập trình backend', 'Trung bình', '2026-03-03 15:56:30', '2025-03-01 00:00:00', NULL),
('CV003', 'TTCV003', 'DA003', 'Test hệ thống', 'Kiểm thử hệ thống', 'Thấp', '2026-03-03 15:56:30', '2025-03-01 00:00:00', NULL),
('CV004', 'TTCV004', 'DA004', 'Viết tài liệu', 'Soạn tài liệu', 'Cao', '2026-03-03 15:56:30', '2025-03-01 00:00:00', NULL),
('CV005', 'TTCV005', 'DA005', 'Fix bug', 'Sửa lỗi', 'Cao', '2026-03-03 15:56:30', '2025-03-01 00:00:00', NULL),
('CV006', 'TTCV006', 'DA006', 'Triển khai server', 'Setup server', 'Trung bình', '2026-03-03 15:56:30', '2025-03-01 00:00:00', NULL),
('CV007', 'TTCV007', 'DA007', 'Phân tích yêu cầu', 'Phân tích BA', 'Thấp', '2026-03-03 15:56:30', '2025-03-01 00:00:00', NULL),
('CV008', 'TTCV008', 'DA008', 'Họp khách hàng', 'Meeting', 'Trung bình', '2026-03-03 15:56:30', '2025-03-01 00:00:00', NULL),
('CV009', 'TTCV009', 'DA009', 'Kiểm thử bảo mật', 'Security test', 'Cao', '2026-03-03 15:56:30', '2025-03-01 00:00:00', NULL),
('CV010', 'TTCV010', 'DA010', 'Deploy sản phẩm', 'Deploy', 'Cao', '2026-03-03 15:56:30', '2025-03-01 00:00:00', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `du_an`
--

CREATE TABLE `du_an` (
  `ma_du_an` varchar(25) NOT NULL,
  `ma_nhom` varchar(25) DEFAULT NULL,
  `ma_phong_ban` varchar(25) DEFAULT NULL,
  `ten_du_an` varchar(150) DEFAULT NULL,
  `mo_ta` text DEFAULT NULL,
  `ngay_bat_dau` datetime DEFAULT NULL,
  `ngay_ket_thuc` datetime DEFAULT NULL,
  `ngay_tao_du_an` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `du_an`
--

INSERT INTO `du_an` (`ma_du_an`, `ma_nhom`, `ma_phong_ban`, `ten_du_an`, `mo_ta`, `ngay_bat_dau`, `ngay_ket_thuc`, `ngay_tao_du_an`) VALUES
('DA001', 'NH001', 'PB001', 'Website A', 'Dự án web A', '2025-01-01 00:00:00', '2025-06-01 00:00:00', '2026-03-03 15:54:44'),
('DA002', 'NH002', 'PB002', 'Website B', 'Dự án web B', '2025-01-01 00:00:00', '2025-06-01 00:00:00', '2026-03-03 15:54:44'),
('DA003', 'NH003', 'PB003', 'Website C', 'Dự án web C', '2025-01-01 00:00:00', '2025-06-01 00:00:00', '2026-03-03 15:54:44'),
('DA004', 'NH004', 'PB004', 'Website D', 'Dự án web D', '2025-01-01 00:00:00', '2025-06-01 00:00:00', '2026-03-03 15:54:44'),
('DA005', 'NH005', 'PB005', 'Website E', 'Dự án web E', '2025-01-01 00:00:00', '2025-06-01 00:00:00', '2026-03-03 15:54:44'),
('DA006', 'NH006', 'PB006', 'Website F', 'Dự án web F', '2025-01-01 00:00:00', '2025-06-01 00:00:00', '2026-03-03 15:54:44'),
('DA007', 'NH007', 'PB007', 'Website G', 'Dự án web G', '2025-01-01 00:00:00', '2025-06-01 00:00:00', '2026-03-03 15:54:44'),
('DA008', 'NH008', 'PB008', 'Website H', 'Dự án web H', '2025-01-01 00:00:00', '2025-06-01 00:00:00', '2026-03-03 15:54:44'),
('DA009', 'NH009', 'PB009', 'Website I', 'Dự án web I', '2025-01-01 00:00:00', '2025-06-01 00:00:00', '2026-03-03 15:54:44'),
('DA010', 'NH010', 'PB010', 'Website K', 'Dự án web K', '2025-01-01 00:00:00', '2025-06-01 00:00:00', '2026-03-03 15:54:44');

-- --------------------------------------------------------

--
-- Table structure for table `nhac_nho`
--

CREATE TABLE `nhac_nho` (
  `ma_nhac_nho` varchar(25) NOT NULL,
  `ma_nhan_vien` varchar(25) DEFAULT NULL,
  `noi_dung` text DEFAULT NULL,
  `thoi_gian_nhac` datetime DEFAULT NULL,
  `ngay_tao` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `nhac_nho`
--

INSERT INTO `nhac_nho` (`ma_nhac_nho`, `ma_nhan_vien`, `noi_dung`, `thoi_gian_nhac`, `ngay_tao`) VALUES
('NN001', 'NV001', 'Nhắc họp', '2025-02-01 08:00:00', '2026-03-03 15:58:28'),
('NN002', 'NV002', 'Nộp báo cáo', '2025-02-01 09:00:00', '2026-03-03 15:58:28'),
('NN003', 'NV003', 'Check task', '2025-02-01 10:00:00', '2026-03-03 15:58:28'),
('NN004', 'NV004', 'Gửi mail', '2025-02-01 11:00:00', '2026-03-03 15:58:28'),
('NN005', 'NV005', 'Test lại', '2025-02-01 12:00:00', '2026-03-03 15:58:28'),
('NN006', 'NV006', 'Backup data', '2025-02-01 13:00:00', '2026-03-03 15:58:28'),
('NN007', 'NV007', 'Update progress', '2025-02-01 14:00:00', '2026-03-03 15:58:28'),
('NN008', 'NV008', 'Gọi khách hàng', '2025-02-01 15:00:00', '2026-03-03 15:58:28'),
('NN009', 'NV009', 'Sửa lỗi', '2025-02-01 16:00:00', '2026-03-03 15:58:28'),
('NN010', 'NV010', 'Deploy', '2025-02-01 17:00:00', '2026-03-03 15:58:28');

-- --------------------------------------------------------

--
-- Table structure for table `nhan_vien`
--

CREATE TABLE `nhan_vien` (
  `ma_nhan_vien` varchar(25) NOT NULL,
  `ma_vai_tro` varchar(25) DEFAULT NULL,
  `ma_phong_ban` varchar(25) DEFAULT NULL,
  `ten_nv` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `trang_thai_hoat_dong` varchar(20) DEFAULT NULL,
  `ngay_tao_nhan_vien` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `nhan_vien`
--

INSERT INTO `nhan_vien` (`ma_nhan_vien`, `ma_vai_tro`, `ma_phong_ban`, `ten_nv`, `email`, `password`, `trang_thai_hoat_dong`, `ngay_tao_nhan_vien`) VALUES
('NV001', 'VT001', 'PB001', 'Nguyễn Văn A', 'a@gmail.com', '123', 'Hoạt động', '2026-03-03 15:53:00'),
('NV002', 'VT002', 'PB002', 'Trần Văn B', 'b@gmail.com', '123', 'Hoạt động', '2026-03-03 15:53:00'),
('NV003', 'VT003', 'PB003', 'Lê Văn C', 'c@gmail.com', '123', 'Hoạt động', '2026-03-03 15:53:00'),
('NV004', 'VT004', 'PB004', 'Phạm Văn D', 'd@gmail.com', '123', 'Hoạt động', '2026-03-03 15:53:00'),
('NV005', 'VT005', 'PB005', 'Hoàng Văn E', 'e@gmail.com', '123', 'Hoạt động', '2026-03-03 15:53:00'),
('NV006', 'VT006', 'PB006', 'Nguyễn Văn F', 'f@gmail.com', '123', 'Hoạt động', '2026-03-03 15:53:00'),
('NV007', 'VT007', 'PB007', 'Trần Văn G', 'g@gmail.com', '123', 'Hoạt động', '2026-03-03 15:53:00'),
('NV008', 'VT008', 'PB008', 'Lê Văn H', 'h@gmail.com', '123', 'Hoạt động', '2026-03-03 15:53:00'),
('NV009', 'VT009', 'PB009', 'Phạm Văn I', 'i@gmail.com', '123', 'Hoạt động', '2026-03-03 15:53:00'),
('NV010', 'VT010', 'PB010', 'Hoàng Văn K', 'k@gmail.com', '123', 'Hoạt động', '2026-03-03 15:53:00');

-- --------------------------------------------------------

--
-- Table structure for table `nhom`
--

CREATE TABLE `nhom` (
  `ma_nhom` varchar(25) NOT NULL,
  `ten_nhom` varchar(100) DEFAULT NULL,
  `thong_tin` text DEFAULT NULL,
  `nguoi_dung_nhom` varchar(25) DEFAULT NULL,
  `ngay_tao_nhom` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `nhom`
--

INSERT INTO `nhom` (`ma_nhom`, `ten_nhom`, `thong_tin`, `nguoi_dung_nhom`, `ngay_tao_nhom`) VALUES
('NH001', 'Nhóm A', 'Nhóm phát triển A', 'NV001', '2026-03-03 15:53:25'),
('NH002', 'Nhóm B', 'Nhóm phát triển B', 'NV002', '2026-03-03 15:53:25'),
('NH003', 'Nhóm C', 'Nhóm phát triển C', 'NV003', '2026-03-03 15:53:25'),
('NH004', 'Nhóm D', 'Nhóm phát triển D', 'NV004', '2026-03-03 15:53:25'),
('NH005', 'Nhóm E', 'Nhóm phát triển E', 'NV005', '2026-03-03 15:53:25'),
('NH006', 'Nhóm F', 'Nhóm phát triển F', 'NV006', '2026-03-03 15:53:25'),
('NH007', 'Nhóm G', 'Nhóm phát triển G', 'NV007', '2026-03-03 15:53:25'),
('NH008', 'Nhóm H', 'Nhóm phát triển H', 'NV008', '2026-03-03 15:53:25'),
('NH009', 'Nhóm I', 'Nhóm phát triển I', 'NV009', '2026-03-03 15:53:25'),
('NH010', 'Nhóm K', 'Nhóm phát triển K', 'NV010', '2026-03-03 15:53:25');

-- --------------------------------------------------------

--
-- Table structure for table `phong_ban`
--

CREATE TABLE `phong_ban` (
  `ma_phong_ban` varchar(25) NOT NULL,
  `ten_phong_ban` varchar(100) DEFAULT NULL,
  `ngay_tao_phong_ban` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `phong_ban`
--

INSERT INTO `phong_ban` (`ma_phong_ban`, `ten_phong_ban`, `ngay_tao_phong_ban`) VALUES
('PB001', 'Phòng IT', '2026-03-03 15:52:36'),
('PB002', 'Phòng Nhân sự', '2026-03-03 15:52:36'),
('PB003', 'Phòng Marketing', '2026-03-03 15:52:36'),
('PB004', 'Phòng Kế toán', '2026-03-03 15:52:36'),
('PB005', 'Phòng Kinh doanh', '2026-03-03 15:52:36'),
('PB006', 'Phòng R&D', '2026-03-03 15:52:36'),
('PB007', 'Phòng Hỗ trợ', '2026-03-03 15:52:36'),
('PB008', 'Phòng QA', '2026-03-03 15:52:36'),
('PB009', 'Phòng Thiết kế', '2026-03-03 15:52:36'),
('PB010', 'Phòng Vận hành', '2026-03-03 15:52:36');

-- --------------------------------------------------------

--
-- Table structure for table `phu_trach`
--

CREATE TABLE `phu_trach` (
  `ma_cong_viec` varchar(25) NOT NULL,
  `ma_nhan_vien` varchar(25) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `phu_trach`
--

INSERT INTO `phu_trach` (`ma_cong_viec`, `ma_nhan_vien`) VALUES
('CV001', 'NV001'),
('CV002', 'NV002'),
('CV003', 'NV003'),
('CV004', 'NV004'),
('CV005', 'NV005'),
('CV006', 'NV006'),
('CV007', 'NV007'),
('CV008', 'NV008'),
('CV009', 'NV009'),
('CV010', 'NV010');

-- --------------------------------------------------------

--
-- Table structure for table `tao`
--

CREATE TABLE `tao` (
  `ma_bao_cao` varchar(25) NOT NULL,
  `ma_nhan_vien` varchar(25) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `tao`
--

INSERT INTO `tao` (`ma_bao_cao`, `ma_nhan_vien`) VALUES
('BC001', 'NV001'),
('BC002', 'NV002'),
('BC003', 'NV003'),
('BC004', 'NV004'),
('BC005', 'NV005'),
('BC006', 'NV006'),
('BC007', 'NV007'),
('BC008', 'NV008'),
('BC009', 'NV009'),
('BC010', 'NV010');

-- --------------------------------------------------------

--
-- Table structure for table `thanh_vien_nhom`
--

CREATE TABLE `thanh_vien_nhom` (
  `ma_nhan_vien` varchar(25) NOT NULL,
  `ma_nhom` varchar(25) NOT NULL,
  `vai_tro` varchar(50) DEFAULT NULL,
  `ngay_tham_gia` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `thanh_vien_nhom`
--

INSERT INTO `thanh_vien_nhom` (`ma_nhan_vien`, `ma_nhom`, `vai_tro`, `ngay_tham_gia`) VALUES
('NV001', 'NH001', 'Leader', '2026-03-03 15:53:54'),
('NV002', 'NH002', 'Leader', '2026-03-03 15:53:54'),
('NV003', 'NH003', 'Leader', '2026-03-03 15:53:54'),
('NV004', 'NH004', 'Leader', '2026-03-03 15:53:54'),
('NV005', 'NH005', 'Leader', '2026-03-03 15:53:54'),
('NV006', 'NH006', 'Leader', '2026-03-03 15:53:54'),
('NV007', 'NH007', 'Leader', '2026-03-03 15:53:54'),
('NV008', 'NH008', 'Leader', '2026-03-03 15:53:54'),
('NV009', 'NH009', 'Leader', '2026-03-03 15:53:54'),
('NV010', 'NH010', 'Leader', '2026-03-03 15:53:54');

-- --------------------------------------------------------

--
-- Table structure for table `to_chuc`
--

CREATE TABLE `to_chuc` (
  `ma_trang_thai` varchar(25) NOT NULL,
  `ma_du_an` varchar(25) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `to_chuc`
--

INSERT INTO `to_chuc` (`ma_trang_thai`, `ma_du_an`) VALUES
('TTDA001', 'DA001'),
('TTDA002', 'DA002'),
('TTDA003', 'DA003'),
('TTDA004', 'DA004'),
('TTDA005', 'DA005'),
('TTDA006', 'DA006'),
('TTDA007', 'DA007'),
('TTDA008', 'DA008'),
('TTDA009', 'DA009'),
('TTDA010', 'DA010');

-- --------------------------------------------------------

--
-- Table structure for table `trang_thai_cong_viec`
--

CREATE TABLE `trang_thai_cong_viec` (
  `ma_trang_thai` varchar(25) NOT NULL,
  `ten_trang_thai` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `trang_thai_cong_viec`
--

INSERT INTO `trang_thai_cong_viec` (`ma_trang_thai`, `ten_trang_thai`) VALUES
('TTCV001', 'Chưa bắt đầu'),
('TTCV002', 'Đang làm'),
('TTCV003', 'Hoàn thành'),
('TTCV004', 'Trễ hạn'),
('TTCV005', 'Tạm dừng'),
('TTCV006', 'Chờ duyệt'),
('TTCV007', 'Đã duyệt'),
('TTCV008', 'Hủy'),
('TTCV009', 'Kiểm thử'),
('TTCV010', 'Triển khai');

-- --------------------------------------------------------

--
-- Table structure for table `trang_thai_du_an`
--

CREATE TABLE `trang_thai_du_an` (
  `ma_trang_thai` varchar(25) NOT NULL,
  `ten_trang_thai` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `trang_thai_du_an`
--

INSERT INTO `trang_thai_du_an` (`ma_trang_thai`, `ten_trang_thai`) VALUES
('TTDA001', 'Khởi tạo'),
('TTDA002', 'Đang thực hiện'),
('TTDA003', 'Tạm dừng'),
('TTDA004', 'Hoàn thành'),
('TTDA005', 'Hủy'),
('TTDA006', 'Chờ duyệt'),
('TTDA007', 'Triển khai'),
('TTDA008', 'Bảo trì'),
('TTDA009', 'Nâng cấp'),
('TTDA010', 'Kết thúc');

-- --------------------------------------------------------

--
-- Table structure for table `vai_tro`
--

CREATE TABLE `vai_tro` (
  `ma_vai_tro` varchar(25) NOT NULL,
  `ten_vai_tro` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_german2_ci;

--
-- Dumping data for table `vai_tro`
--

INSERT INTO `vai_tro` (`ma_vai_tro`, `ten_vai_tro`) VALUES
('VT001', 'Quản trị viên'),
('VT002', 'Trưởng phòng'),
('VT003', 'Phó phòng'),
('VT004', 'Nhân viên'),
('VT005', 'Thực tập sinh'),
('VT006', 'Leader'),
('VT007', 'Tester'),
('VT008', 'Developer'),
('VT009', 'BA'),
('VT010', 'HR');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `bao_cao`
--
ALTER TABLE `bao_cao`
  ADD PRIMARY KEY (`ma_bao_cao`);

--
-- Indexes for table `binh_luan_cv`
--
ALTER TABLE `binh_luan_cv`
  ADD PRIMARY KEY (`ma_binh_luan`),
  ADD KEY `ma_nhan_vien` (`ma_nhan_vien`),
  ADD KEY `ma_cong_viec` (`ma_cong_viec`);

--
-- Indexes for table `cong_viec`
--
ALTER TABLE `cong_viec`
  ADD PRIMARY KEY (`ma_cong_viec`),
  ADD KEY `ma_trang_thai` (`ma_trang_thai`),
  ADD KEY `ma_du_an` (`ma_du_an`);

--
-- Indexes for table `du_an`
--
ALTER TABLE `du_an`
  ADD PRIMARY KEY (`ma_du_an`),
  ADD KEY `ma_nhom` (`ma_nhom`),
  ADD KEY `ma_phong_ban` (`ma_phong_ban`);

--
-- Indexes for table `nhac_nho`
--
ALTER TABLE `nhac_nho`
  ADD PRIMARY KEY (`ma_nhac_nho`),
  ADD KEY `ma_nhan_vien` (`ma_nhan_vien`);

--
-- Indexes for table `nhan_vien`
--
ALTER TABLE `nhan_vien`
  ADD PRIMARY KEY (`ma_nhan_vien`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `ma_vai_tro` (`ma_vai_tro`),
  ADD KEY `ma_phong_ban` (`ma_phong_ban`);

--
-- Indexes for table `nhom`
--
ALTER TABLE `nhom`
  ADD PRIMARY KEY (`ma_nhom`),
  ADD KEY `nguoi_dung_nhom` (`nguoi_dung_nhom`);

--
-- Indexes for table `phong_ban`
--
ALTER TABLE `phong_ban`
  ADD PRIMARY KEY (`ma_phong_ban`);

--
-- Indexes for table `phu_trach`
--
ALTER TABLE `phu_trach`
  ADD PRIMARY KEY (`ma_cong_viec`,`ma_nhan_vien`),
  ADD KEY `ma_nhan_vien` (`ma_nhan_vien`);

--
-- Indexes for table `tao`
--
ALTER TABLE `tao`
  ADD PRIMARY KEY (`ma_bao_cao`,`ma_nhan_vien`),
  ADD KEY `ma_nhan_vien` (`ma_nhan_vien`);

--
-- Indexes for table `thanh_vien_nhom`
--
ALTER TABLE `thanh_vien_nhom`
  ADD PRIMARY KEY (`ma_nhan_vien`,`ma_nhom`),
  ADD KEY `ma_nhom` (`ma_nhom`);

--
-- Indexes for table `to_chuc`
--
ALTER TABLE `to_chuc`
  ADD PRIMARY KEY (`ma_trang_thai`,`ma_du_an`),
  ADD KEY `ma_du_an` (`ma_du_an`);

--
-- Indexes for table `trang_thai_cong_viec`
--
ALTER TABLE `trang_thai_cong_viec`
  ADD PRIMARY KEY (`ma_trang_thai`);

--
-- Indexes for table `trang_thai_du_an`
--
ALTER TABLE `trang_thai_du_an`
  ADD PRIMARY KEY (`ma_trang_thai`);

--
-- Indexes for table `vai_tro`
--
ALTER TABLE `vai_tro`
  ADD PRIMARY KEY (`ma_vai_tro`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `binh_luan_cv`
--
ALTER TABLE `binh_luan_cv`
  MODIFY `ma_binh_luan` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `binh_luan_cv`
--
ALTER TABLE `binh_luan_cv`
  ADD CONSTRAINT `binh_luan_cv_ibfk_1` FOREIGN KEY (`ma_nhan_vien`) REFERENCES `nhan_vien` (`ma_nhan_vien`),
  ADD CONSTRAINT `binh_luan_cv_ibfk_2` FOREIGN KEY (`ma_cong_viec`) REFERENCES `cong_viec` (`ma_cong_viec`);

--
-- Constraints for table `cong_viec`
--
ALTER TABLE `cong_viec`
  ADD CONSTRAINT `cong_viec_ibfk_1` FOREIGN KEY (`ma_trang_thai`) REFERENCES `trang_thai_cong_viec` (`ma_trang_thai`),
  ADD CONSTRAINT `cong_viec_ibfk_2` FOREIGN KEY (`ma_du_an`) REFERENCES `du_an` (`ma_du_an`);

--
-- Constraints for table `du_an`
--
ALTER TABLE `du_an`
  ADD CONSTRAINT `du_an_ibfk_1` FOREIGN KEY (`ma_nhom`) REFERENCES `nhom` (`ma_nhom`),
  ADD CONSTRAINT `du_an_ibfk_2` FOREIGN KEY (`ma_phong_ban`) REFERENCES `phong_ban` (`ma_phong_ban`);

--
-- Constraints for table `nhac_nho`
--
ALTER TABLE `nhac_nho`
  ADD CONSTRAINT `nhac_nho_ibfk_1` FOREIGN KEY (`ma_nhan_vien`) REFERENCES `nhan_vien` (`ma_nhan_vien`);

--
-- Constraints for table `nhan_vien`
--
ALTER TABLE `nhan_vien`
  ADD CONSTRAINT `nhan_vien_ibfk_1` FOREIGN KEY (`ma_vai_tro`) REFERENCES `vai_tro` (`ma_vai_tro`),
  ADD CONSTRAINT `nhan_vien_ibfk_2` FOREIGN KEY (`ma_phong_ban`) REFERENCES `phong_ban` (`ma_phong_ban`);

--
-- Constraints for table `nhom`
--
ALTER TABLE `nhom`
  ADD CONSTRAINT `nhom_ibfk_1` FOREIGN KEY (`nguoi_dung_nhom`) REFERENCES `nhan_vien` (`ma_nhan_vien`);

--
-- Constraints for table `phu_trach`
--
ALTER TABLE `phu_trach`
  ADD CONSTRAINT `phu_trach_ibfk_1` FOREIGN KEY (`ma_cong_viec`) REFERENCES `cong_viec` (`ma_cong_viec`),
  ADD CONSTRAINT `phu_trach_ibfk_2` FOREIGN KEY (`ma_nhan_vien`) REFERENCES `nhan_vien` (`ma_nhan_vien`);

--
-- Constraints for table `tao`
--
ALTER TABLE `tao`
  ADD CONSTRAINT `tao_ibfk_1` FOREIGN KEY (`ma_bao_cao`) REFERENCES `bao_cao` (`ma_bao_cao`),
  ADD CONSTRAINT `tao_ibfk_2` FOREIGN KEY (`ma_nhan_vien`) REFERENCES `nhan_vien` (`ma_nhan_vien`);

--
-- Constraints for table `thanh_vien_nhom`
--
ALTER TABLE `thanh_vien_nhom`
  ADD CONSTRAINT `thanh_vien_nhom_ibfk_1` FOREIGN KEY (`ma_nhan_vien`) REFERENCES `nhan_vien` (`ma_nhan_vien`),
  ADD CONSTRAINT `thanh_vien_nhom_ibfk_2` FOREIGN KEY (`ma_nhom`) REFERENCES `nhom` (`ma_nhom`);

--
-- Constraints for table `to_chuc`
--
ALTER TABLE `to_chuc`
  ADD CONSTRAINT `to_chuc_ibfk_1` FOREIGN KEY (`ma_trang_thai`) REFERENCES `trang_thai_du_an` (`ma_trang_thai`),
  ADD CONSTRAINT `to_chuc_ibfk_2` FOREIGN KEY (`ma_du_an`) REFERENCES `du_an` (`ma_du_an`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
