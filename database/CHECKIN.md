# Điểm danh QR và mã dự phòng

## Phạm vi

Migration 012 và các hàm PostgreSQL là phần database. Chưa có API, giao diện QR,
camera hoặc ô nhập mã trong frontend. Backend hiện chưa xác thực người dùng và
SeatReservationService vẫn dùng user_id = 1; cần nối tài khoản thật trước khi dùng thực tế.

## Quy tắc

- `checkins.method`: `QR`, `MANUAL_CODE`.
- `checkins.status`: `SUCCESS`, `FAILED`. Lỗi submit hiện được trả bằng exception,
  không tự tạo bản ghi FAILED; backend có thể ghi log thất bại riêng.
- Một SUCCESS cho mỗi `(booking_id, user_id)` qua partial unique index, bao gồm
  trường hợp QR và mã tay gửi đồng thời. Migration 006 bảo đảm một booking/buổi học.
- Giảng viên sở hữu booking hoặc ADMIN phát mã chung cho buổi học CONFIRMED đang diễn ra.
  Schema hiện chưa có teacher_id nên tạm xác định giảng viên qua bookings.user_id.
- Sinh viên phải có role STUDENT và seat_reservation CONFIRMED đúng buổi học.
- QR chứa `qr_token` UUID; dưới QR hiển thị `manual_code` đúng 5 ký tự có cả chữ và số.
  Mã dự phòng là mã ngắn ngẫu nhiên, không phải hash mật mã; hiện dùng chữ A–F và số 0–9.
- Mỗi lần phát tạo cả QR token và mã ngắn mới, thu hồi cả hai mã cũ. Mã ngắn không tái sử
  dụng trong cùng buổi. Mã hết hạn khi kết thúc buổi học; không có thời gian cho check-in sớm.
- Không phát mã mới riêng cho từng sinh viên. Cùng một mã dùng cho những sinh viên của buổi.
- Submit ghi checkins và attendance trong cùng giao dịch với cùng thời gian server;
  đánh dấu PRESENT. Chưa có quy tắc phân biệt LATE.
- Mã chung xác minh biết mã và có đặt chỗ, chưa chứng minh vị trí vật lý trong lớp.

## Áp dụng

1. Chạy `scripts/preflight_checkins.sql` chỉ đọc trên database thật.
2. Kiểm tra đã có migration 001, 002, 006, 008. Migration 012 không phụ thuộc 011.
   File 011 hiện có lỗi cú pháp/dẫn chiếu ngoài phạm vi thay đổi này.
3. Chạy `migrations/012_checkin_qr_manual_code.sql` đúng một lần. Backend không tự chạy file này.

Migration chuẩn hóa chữ hoa/khoảng trắng nhưng không đoán ý nghĩa status cũ, không xóa
dữ liệu trùng. Nếu method/status không thuộc tập mới hoặc SUCCESS bị trùng, toàn bộ
migration rollback; cần đối chiếu dữ liệu rồi quyết định cách chuyển đổi.

## Tích hợp backend/frontend tiếp theo

Backend gọi bằng prepared statement, lấy actor/student từ phiên đăng nhập đáng tin cậy,
không lấy ID từ request của sinh viên. Các hàm chạy theo quyền caller và đã REVOKE PUBLIC;
cấp EXECUTE cùng quyền bảng/sequence cần thiết cho tài khoản backend riêng. Không cho
client kết nối thẳng DB hoặc đọc bảng checkin_challenges.

```sql
SELECT * FROM issue_checkin_challenge(:session_id, :authenticated_teacher_id);
SELECT submit_class_checkin(:session_id, :authenticated_student_id, 'QR', :qr_token);
SELECT submit_class_checkin(:session_id, :authenticated_student_id, 'MANUAL_CODE', :manual_code);
```

Endpoint phát mã chỉ trả token/mã cho giảng viên của buổi hoặc admin. Frontend giảng viên
render QR và mã ngắn bên dưới; frontend sinh viên có camera và ô nhập mã dự phòng.
Cả hai đường submit dùng chung endpoint/service; mã nhập tay chấp nhận chữ thường,
chữ hoa và bỏ khoảng trắng đầu/cuối. Backend phải giới hạn số lần thử theo tài khoản/buổi
và IP trước khi mở endpoint mã ngắn, đồng thời dùng HTTPS. Không ghi token/mã vào log.
Trả HTTP 409 cho vi phạm `uq_checkins_success_booking_user`; trả lỗi mã hết hạn/sai mã
và thiếu đặt ghế theo thông báo nghiệp vụ. Không tự động thay đổi đánh giá thủ công
EXCUSED/ABSENT nếu nghiệp vụ sau này yêu cầu bảo toàn đánh giá đó (hàm hiện chuyển PRESENT).

## Kiểm chứng

Trên PostgreSQL 18 riêng, chạy 001 → 002 → 006 → 008 → 012 rồi
`tests/verify_checkin_codes.sql`. Test rollback dữ liệu; không chạy trên database thật.
