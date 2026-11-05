# Chạy FE ↔ BE ↔ PostgreSQL

1. Chạy PostgreSQL với database `smart_campus` và các file SQL `001` đến `008` trong `migrations` theo đúng thứ tự. Nếu database đã có `001`–`007`, chỉ chạy `008_attendance_cancellation.sql` một lần trong pgAdmin, chọn database `smart_campus`. Database cần có `rooms.type` (`THEORY`, `LAB`, `STUDY`).
2. Trước khi chạy BE, đặt biến môi trường `DB_PASSWORD` (mật khẩu PostgreSQL hiện tại) và `JWT_SECRET` (chuỗi ngẫu nhiên ít nhất 32 byte). Ví dụ trong PowerShell, dùng `$env:DB_PASSWORD = Read-Host 'DB password'` và `$env:JWT_SECRET = Read-Host 'JWT secret'`; không lưu giá trị thật trong repo. Có thể đặt `DB_URL` và `DB_USER` nếu khác mặc định. Trong `backend`, chạy `.\mvnw.cmd spring-boot:run` từ cùng cửa sổ PowerShell. Đây là ứng dụng backend chính, không dùng `MockBackendApplication`.
3. Trong `frontend`, chạy `npm run dev`. Mở `http://localhost:3000`. Next.js chuyển `/api/v1/*` tới backend trên cổng 8080. Đăng nhập bằng tài khoản seed từ migration `004`: `admin@smartcampus.test` / `Admin@123`, `teacher@smartcampus.test` / `Teacher@123`, hoặc `student@smartcampus.test` / `Student@123`. Đổi mật khẩu seed trước khi đưa hệ thống ra ngoài môi trường trình diễn.

FE hiện đọc phòng, đặt phòng, buổi học và ghế từ backend. Admin có thể tạo/sửa phòng và đổi trạng thái qua `POST /api/v1/rooms` và `PATCH /api/v1/rooms/{id}`. Sức chứa là số ghế trong bảng `seats`; BE tạo ghế khi tạo phòng và đồng bộ ghế khi sửa sức chứa. BE từ chối giảm sức chứa nếu ghế bị tham chiếu trong lịch sử đặt chỗ. Giảng viên tạo lượt đặt phòng học và buổi học; sinh viên chọn ghế của buổi học hoặc đặt phòng tự học. Dữ liệu sẽ còn sau khi khởi động lại ứng dụng.

Nếu database đã chạy migration `006` trước khi thay đổi quy tắc một người một ghế, chạy trong pgAdmin sau khi kiểm tra không có người dùng đặt nhiều ghế đang hoạt động:

```sql
DROP INDEX IF EXISTS uq_seat_reservations_active_user;
CREATE UNIQUE INDEX uq_seat_reservations_active_user
    ON seat_reservations (user_id)
    WHERE status = 'CONFIRMED';
```

### Thử QR điểm danh

Tạo buổi học bắt đầu khoảng 5–20 phút trước thời điểm thử, duyệt yêu cầu đặt phòng bằng tài khoản admin, rồi đặt một ghế bằng tài khoản sinh viên. Giảng viên mở **Điểm danh**, chọn buổi học và bấm **Tạo / làm mới mã QR**. Sinh viên mở **Check-in**, bấm **Mở camera quét QR**, quét mã và bấm **Xác nhận check-in**. QR chỉ được tạo và quét từ phút thứ 5 đến trước phút thứ 20 sau giờ bắt đầu (hoặc đến giờ kết thúc buổi học nếu sớm hơn). Trở lại màn giảng viên và bấm **Tải lại điểm danh** để xem ghế đã điểm danh; chọn ghế đó để **Hủy điểm danh**. Lần hủy được giữ trong DB, và sinh viên có thể điểm danh lại nếu vẫn trong cửa sổ thời gian. Mã hết hạn sau tối đa 2 phút; tạo mã mới sẽ làm mã cũ mất hiệu lực. Có thể nhập mã thủ công khi trình duyệt không hỗ trợ quét hoặc không có camera. Camera cần `localhost` hoặc HTTPS và quyền truy cập camera của trình duyệt.

API: `POST /api/v1/auth/login` nhận email/password và trả JWT. Các endpoint nghiệp vụ dùng `Authorization: Bearer <token>`; BE lấy user ID từ token, không nhận `X-Demo-User-Id`. `POST /api/v1/class-sessions/{id}/qr`, `POST /api/v1/attendance/check-in` với JSON `{ "qrCode": "...", "classSessionId": 1 }`, `GET /api/v1/attendance?classSessionId=1`, `DELETE /api/v1/attendance/{id}`. BE kiểm tra vai trò cho luồng QR trong DB, chủ buổi học, đặt phòng đã duyệt, thời gian, ghế đã đặt và check-in trùng; bản ghi được lưu vào `checkins` và `attendance`.

FE giữ JWT trong `sessionStorage` cho phiên trình diễn. Chưa có RBAC theo từng endpoint, refresh token, giới hạn thử đăng nhập hay luồng quên mật khẩu; cần hoàn thiện trước khi triển khai thực tế. Mật khẩu PostgreSQL từng nằm trong cấu hình cũ: hãy đổi mật khẩu DB và dùng giá trị mới cho `DB_PASSWORD`. Các màn tài nguyên, sự cố và thông báo vẫn chưa nối API thật.
