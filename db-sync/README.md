# Database đồng bộ

Đây là bộ migration **độc lập** cho một PostgreSQL database trống. Chạy `migrations/001` đến `migrations/018` theo tên file. Các file `001`–`016` dựa trên `../database/migrations`; quy tắc phòng, báo vắng, điểm danh và phân quyền được gộp vào file chức năng tương ứng. File `017` bổ sung hồ sơ tài khoản và tiếp nhận sinh viên chưa có ở bộ nền; file `018` lưu năm vào trường trong hồ sơ CSV. Với database đã chạy đến `017`, chỉ chạy tiếp `018`. Không chạy thêm `../migrations` hoặc `../migrations/fresh` vào cùng database. `004` chứa tài khoản, phòng, thiết bị và booking mẫu; các booking mẫu có ngày cố định 16/10/2026.

## Chức năng và quy tắc dữ liệu

- Phòng: trigger lấy tiền tố mã phòng, `A → LAB` (thực hành), `B → THEORY` (lý thuyết), `C → SELF_STUDY` (tự học). Giá trị cuối lưu ở `rooms.type`. Trigger booking chỉ cho giảng viên đặt LAB/THEORY và sinh viên đặt SELF_STUDY.
- Booking: giữ exclusion constraint chống trùng phòng/giờ, kể cả hai giao dịch đồng thời. Buổi học phải khớp phòng/giờ với booking.
- Ghế: giữ 2 phút (`PENDING`), xác nhận (`CONFIRMED`), hủy (`CANCELLED`); một người một ghế trong **mỗi buổi học**. Các hàm `hold_class_seat`, `confirm_class_seat`, `cancel_class_seat` và view `class_seat_availability` thuộc bộ nền.
- Tài khoản: `users` có hồ sơ, khoa và trạng thái kích hoạt; `user_invites` giữ token. `faculties` ánh xạ 16 khoa theo mã A–P. Khi admin nhập CSV Google Form, backend tự tạo tài khoản cho từng dòng hợp lệ, cấp mã theo khoa và năm vào trường, tạo email đăng nhập từ mã và gửi liên kết kích hoạt tới email cá nhân. Dòng lỗi được trả riêng; không cần duyệt thủ công. Hồ sơ cũ còn `PENDING` có thể thử tạo lại. Mã được sinh ở lớp nghiệp vụ, không tự sinh khi chỉ INSERT hồ sơ.
- Báo vắng giảng viên: chỉ gửi cho buổi đã duyệt, chậm nhất 60 phút trước giờ bắt đầu. Admin có thể duyệt yêu cầu gửi đúng hạn sau mốc này. Khi còn chờ duyệt, lịch sinh viên vẫn hiển thị bình thường; khi duyệt, `review_teacher_absence` giải phóng phòng/ghế và trigger tạo thông báo cho giảng viên cùng sinh viên đã xác nhận ghế trong một transaction.
- Báo vắng sinh viên: phải có ghế `CONFIRMED` trong buổi đó và gửi chậm nhất 15 phút trước giờ bắt đầu. Giảng viên dạy buổi đó dùng `review_student_absence` để duyệt hoặc từ chối; duyệt sẽ ghi `EXCUSED` vào điểm danh. `class_session_calendar` suy trạng thái buổi học từ yêu cầu giảng viên đã duyệt; đơn đang chờ không làm đổi lịch sinh viên.
- Điểm danh: `checkin_challenges` có QR và mã dự phòng; mã chỉ phát từ phút 5 đến phút 20 sau giờ bắt đầu, tối đa 2 phút hiệu lực. `revoke_class_checkin` cho giảng viên hủy kết quả, giữ check-in cũ với `revoked_at/by`. Sinh viên có thể quét lại trong khung giờ; một attendance hiện hành cho mỗi sinh viên/buổi học.
- Thiết bị, sự cố, thông báo, audit và RLS lấy từ bộ nền. Resource trong sự cố phải thuộc đúng phòng. Quyền báo sự cố của sinh viên được gỡ; chính sách INSERT sự cố chỉ nhận giảng viên.

## Phạm vi chưa chốt

Chưa thêm quan hệ sinh viên đăng ký lớp/môn vì nhóm chưa thống nhất mô hình. DB hiện chưa thể tự xác định tất cả môn mà từng sinh viên học; trigger báo vắng hiện chỉ thông báo cho người đã xác nhận ghế, chưa thể thông báo cho toàn lớp. Các hàm SQL nhận ID từ backend đã xác thực; không cho client tự gửi ID hoặc kết nối thẳng DB. RLS cần backend đặt context trong đúng transaction và tài khoản DB không bypass RLS.

## Trước khi dùng với ứng dụng

BE hiện dùng cách ghi ghế và QR cũ, nên phải đổi API theo các hàm của bộ DB này. Entity `Room` cũng cần ánh xạ sang `rooms.type`. `spring.jpa.hibernate.ddl-auto=validate` chỉ kiểm tra entity, không chứng minh toàn bộ chức năng. Cần chạy migration trên DB thử, chạy các SQL test trong `../database/tests`, rồi kiểm tra end to end trước khi chuyển DB thật.

Tạo database với mã hóa UTF-8 để lưu tên khoa tiếng Việt. Chạy từng file bằng `psql -v ON_ERROR_STOP=1` trên database thử, theo đúng thứ tự; không chạy cả bộ trong một transaction vì các file nền có transaction riêng.
