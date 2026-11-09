# Permission Role

# PR 01: Role Admin
- Quản trị danh sách phòng (trống / đã đặt)
- Quản lý các tài nguyên ( Thêm / sửa / hủy phòng ) 
- Chấp nhận các yêu cầu đặt phòng
- Tiếp nhận các báo cáo sự cố
- Quản lý các tài khoản Teacher, Student

# PR 02: Role Teacher
- Xem lịch giảng dạy của mình
- Đặt phòng học (loại phòng, số lượng chỗ ngồi) nhưng phải đợi Admin duyệt
- Báo cáo sự cố trong phòng học
- Xem sơ đồ lớp và dữ liệu điểm danh

# PR 03:Role Student 
- Chỉ thấy được lịch học cá nhân (phòng học sẽ do Teacher đặt và Admin duyệt)
- Chọn chỗ ngồi trước khi bắt đầu giờ học khoảng 60 phút
- Mỗi vị trí ngồi sẽ có mỗi mã QR check-in điểm danh, Student sẽ quét bằng tài khoản hệ thống để ghi nhận dữ liệu điểm danh
- Báo cáo sự cố trong phòng học


# Core Features

# CF 01: JWT Authentication
- Sử dụng jwt để xác định danh tính
- Dùng cơ chế rbac (Role - Base access control) - kiểm soát truy cập dựa trên vai trò

# CF 02: Schedule 
- Frontend: Dùng ReactJS làm framework và Typescript, đồng bộ dữ liệu thời gian thực (Real-time) từ Admin

# CF 03: Watch resource: 
- Chỉ thấy được lịch học cá nhân (phòng học sẽ do Teacher đặt và Admin duyệt)
- Chọn chỗ ngồi trước khi bắt đầu giờ học khoảng 60 phút
- Mỗi vị trí ngồi sẽ có mỗi mã QR check-in điểm danh, Student sẽ quét bằng tài khoản hệ thống để ghi nhận dữ liệu điểm danh
- Báo cáo sự cố trong phòng học

# CF 04: Set auto-room
- Hệ thống tự động kiểm tra xung đột qua thuật toán backend. 
- Yêu cầu được duyệt tức thì: trả mã 201 (Thành công) nếu phòng trống hoặc 409 (Trùng lịch) nếu bận, không cần phê duyệt thủ công.

# CF 05: QR
- Sinh viên chọn chỗ ngồi qua "Seat Picker" trước giờ học 60 phút, sau đó quét mã QR định danh ngay tại vị trí đã chọn để xác nhận có mặt.

# CF 06: Notifications
- Hệ thống tự động gửi phản hồi về trạng thái đặt phòng, xác nhận check-in hoặc kết quả báo cáo sự cố.
