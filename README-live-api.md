# Chạy FE ↔ BE ↔ PostgreSQL

1. Chạy PostgreSQL với database `smart_campus` và các file SQL `001` đến `008` trong `migrations` theo đúng thứ tự. Nếu database đã có `001`–`007`, chỉ chạy `008_attendance_cancellation.sql` một lần trong pgAdmin, chọn database `smart_campus`. Database cần có `rooms.type` (`THEORY`, `LAB`, `STUDY`).
2. Trong `backend`, chạy `./mvnw.cmd spring-boot:run` (PowerShell: `.\mvnw.cmd spring-boot:run`). Đây là ứng dụng backend chính, không dùng `MockBackendApplication`.
3. Trong `frontend`, chạy `npm run dev`. Mở `http://localhost:3000`. Next.js chuyển `/api/v1/*` tới backend trên cổng 8080.

FE hiện đọc phòng, đặt phòng, buổi học và ghế từ backend. Giảng viên tạo lượt đặt phòng học và buổi học; sinh viên chọn ghế của buổi học hoặc đặt phòng tự học. Buổi học mới chỉ xuất hiện sau khi giảng viên đặt phòng. Dữ liệu sẽ còn sau khi khởi động lại ứng dụng.

Nếu database đã chạy migration `006` trước khi thay đổi quy tắc một người một ghế, chạy trong pgAdmin sau khi kiểm tra không có người dùng đặt nhiều ghế đang hoạt động:

```sql
DROP INDEX IF EXISTS uq_seat_reservations_active_user;
CREATE UNIQUE INDEX uq_seat_reservations_active_user
    ON seat_reservations (user_id)
    WHERE status = 'CONFIRMED';
```

### Thử QR điểm danh

Tạo buổi học bắt đầu khoảng 5–20 phút trước thời điểm thử, duyệt yêu cầu đặt phòng bằng tài khoản admin, rồi đặt một ghế bằng tài khoản sinh viên. Giảng viên mở **Điểm danh**, chọn buổi học và bấm **Tạo / làm mới mã QR**. Sinh viên mở **Check-in**, bấm **Mở camera quét QR**, quét mã và bấm **Xác nhận check-in**. QR chỉ được tạo và quét từ phút thứ 5 đến trước phút thứ 20 sau giờ bắt đầu (hoặc đến giờ kết thúc buổi học nếu sớm hơn). Trở lại màn giảng viên và bấm **Tải lại điểm danh** để xem ghế đã điểm danh; chọn ghế đó để **Hủy điểm danh**. Lần hủy được giữ trong DB, và sinh viên có thể điểm danh lại nếu vẫn trong cửa sổ thời gian. Mã hết hạn sau tối đa 2 phút; tạo mã mới sẽ làm mã cũ mất hiệu lực. Có thể nhập mã thủ công khi trình duyệt không hỗ trợ quét hoặc không có camera. Camera cần `localhost` hoặc HTTPS và quyền truy cập camera của trình duyệt.

API: `POST /api/v1/class-sessions/{id}/qr`, `POST /api/v1/attendance/check-in` với JSON `{ "qrCode": "...", "classSessionId": 1 }`, `GET /api/v1/attendance?classSessionId=1`, `DELETE /api/v1/attendance/{id}`. Các endpoint dùng header `X-Demo-User-Id` của tài khoản giảng viên hoặc sinh viên hiện tại. BE kiểm tra vai trò trong DB, chủ buổi học, đặt phòng đã duyệt, thời gian, ghế đã đặt và check-in trùng; bản ghi được lưu vào `checkins` và `attendance`.

Đăng nhập phía FE vẫn là tài khoản demo và `X-Demo-User-Id` có thể bị giả mạo. Cần thay bằng xác thực thật trước khi dùng ngoài môi trường trình diễn. Các màn tài nguyên, sự cố và thông báo vẫn chưa nối API thật.
