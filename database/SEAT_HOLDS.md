# Giữ ghế theo buổi học — migration 015

Đã áp dụng trong **file DB** theo yêu cầu; chưa chạy vào CNPM thật. Không sửa backend/frontend. Thời hạn giữ mặc định: **2 phút**, tính bằng đồng hồ DB từ lúc ghi thành công.

| Hiển thị | DB |
|---|---|
| Chưa đặt | Không có đăng ký hiệu lực, hoặc hold đã hết hạn |
| Đang xác nhận | `seat_reservations.status = PENDING`, chưa tới `hold_expires_at` |
| Đã đặt | `seat_reservations.status = CONFIRMED` |

`seats.status` giữ tình trạng vật lý AVAILABLE/…; trạng thái đăng ký thuộc từng `class_session_id`. FK ghép có sẵn tiếp tục chặn ghế khác phòng. Hai unique index theo session/ghế và session/user nay áp dụng cho **cả PENDING và CONFIRMED**. Dữ liệu CONFIRMED/CANCELLED cũ không bị chuyển trạng thái.

## Luồng gọi DB

Trong mỗi transaction ngắn, dùng ID người dùng từ backend đã xác thực:

```sql
BEGIN;
SELECT * FROM hold_class_seat(:class_session_id, :seat_id, :student_id);
COMMIT;
-- Lưu seat_reservation_id của kết quả. Không giữ transaction mở khi chờ bấm nút.

BEGIN;
SELECT * FROM confirm_class_seat(:seat_reservation_id, :student_id);
COMMIT;

-- Bỏ chọn/hủy:
SELECT * FROM cancel_class_seat(:seat_reservation_id, :student_id);

SELECT * FROM class_seat_availability WHERE class_session_id = :class_session_id;
```

Các dấu `:...` là tham số để backend bind hoặc thay bằng ID thử trong Query Tool, không phải SQL tự chạy nguyên văn trong psql.

- `hold_class_seat`: chỉ STUDENT, booking lớp phải CONFIRMED, ghế AVAILABLE và thuộc đúng phòng; giữ 2 phút. Retry cùng người/cùng ghế trả bản ghi cũ, không gia hạn.
- `confirm_class_seat`: chỉ chủ lượt giữ, còn hạn, lớp được duyệt. Chuyển sang CONFIRMED; gọi lại sau khi thành công trả bản ghi đã xác nhận.
- `cancel_class_seat`: chỉ chủ lượt đăng ký; lưu CANCELLED để giữ lịch sử.
- Mỗi hàm dùng khóa session/booking và unique index để phân xử cạnh tranh. Người thắng là giao dịch được DB chấp nhận, không nhất thiết người bấm trước theo đồng hồ điện thoại.
- Sai chủ/không phải STUDENT: SQLSTATE 42501. Ghế/người đã có lượt hiệu lực: 23505. Chưa duyệt, hết hạn hoặc ghế không hợp lệ: 23514. Không tìm thấy ID: P0002. Backend tương lai cần xử lý các lỗi này và rollback transaction lỗi.

## Hết hạn và an toàn ghi

DB không tự chạy UPDATE vào đúng giây hết hạn. View `class_seat_availability` đọc hold hết hạn là AVAILABLE; lần gọi giữ ghế kế tiếp trong session chuyển các hold hết hạn thành CANCELLED rồi giữ ghế mới trong cùng transaction. Không cần scheduler. Nếu chỉ INSERT trực tiếp mà bỏ qua hàm, unique index có thể vẫn chặn bởi hàng PENDING đã hết hạn; đường ghi được hỗ trợ là các hàm trên.

Trigger kiểm tra booking CONFIRMED cho đăng ký đang hiệu lực, tự điền hạn giữ khi INSERT PENDING thiếu hạn, và chặn PENDING hết hạn chuyển CONFIRMED. Các hàm được REVOKE khỏi PUBLIC, chạy theo quyền caller; cần cấp EXECUTE/table/sequence permissions cho role backend tin cậy khi tích hợp. Không cấp SQL client cho sinh viên; tham số student_id không tự xác thực người gọi. Role có quyền ghi trực tiếp vẫn có thể INSERT CONFIRMED; migration này không thay toàn bộ mô hình grants/RBAC.

View trả `reservation_status` và `physical_status` riêng: AVAILABLE về đặt chỗ không đồng nghĩa ghế hỏng được phép chọn. View chỉ mô tả trạng thái ghế, không quyết định quyền truy cập hay việc lớp đã được duyệt.

**Backend hiện tại chưa tích hợp hold/confirm/view.** INSERT không truyền status nay mặc định PENDING; code đọc chỉ CONFIRMED sẽ chưa hiển thị được ghế đang giữ. Cần chuyển endpoint sang gọi các hàm và đọc view khi nhóm backend làm tích hợp. Không dùng SQL 015 để tuyên bố UI đã hoạt động đầy đủ.

## Kiểm chứng và triển khai

- `tests/verify_seat_holds.sql`: chưa duyệt bị chặn, hạn 2 phút, retry không gia hạn, sai chủ bị chặn, ghế PENDING/CONFIRMED không trùng, hết hạn không xác nhận được, giải phóng và đặt lại, view, không sửa trạng thái vật lý.
- `scripts/Test-SeatHoldRace.ps1`: hai kết nối đồng thời, đúng một lượt giữ commit; lượt còn lại bị 23505. Chỉ nhận DB thử tên campus_rc_…; fixture được dọn sau test.
- `scripts/Test-Release.ps1`: chạy từ DB trống 001–015, các test và race, rồi backup/restore và so fingerprint. Kết quả thực tế trong `evidence/RESULT.txt`, `verify_seat_holds.log`, `seat-hold-race.log`.
- CNPM thật: backup và kiểm kê schema trước; 015 yêu cầu 001–014 đã có. Không chạy lại các migration cũ hoặc cả bộ vào DB đã tồn tại. Chỉ triển khai 015 khi nhóm backend sẵn sàng với default PENDING và luồng gọi mới.
