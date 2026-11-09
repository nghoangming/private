# Nhập hồ sơ sinh viên từ Google Form

## Chuẩn bị Form

Tạo câu hỏi đúng tiêu đề: `Họ và tên`, `Số điện thoại`, `Ngày sinh`, `Giới tính`, `Email cá nhân`, `Khoa`. Giới tính chọn `Nam`, `Nữ` hoặc `Khác`. Lựa chọn khoa bắt đầu bằng mã `A` đến `P`, ví dụ `A - Công nghệ thông tin`. Ngày sinh theo `dd/MM/yyyy`. Không hỏi vai trò, mã sinh viên hay email trường.

## Nhập dữ liệu

1. Với database hiện có, chạy migration `014_user_profile_fields.sql`, `015_student_intake.sql`, `016_remove_student_major.sql` theo thứ tự nếu chưa chạy. Với database mới, chạy `migrations/fresh/001_schema.sql` thay cho toàn bộ `001`–`016`.
2. Trong Google Form mở bảng tính phản hồi. Tại Google Sheets chọn **Tệp → Tải xuống → Giá trị được phân tách bằng dấu phẩy (.csv)**. Cột thời gian phản hồi được phép giữ nguyên.
3. Đăng nhập admin, mở **Người dùng → Nhập CSV từ Google Form**, chọn file vừa tải và bấm **Nhập hồ sơ chờ duyệt**. File UTF-8 tối đa 1 MB, 500 phản hồi. Kết quả hiện số dòng thành công và lỗi.
4. Trong **Hồ sơ chờ duyệt**, kiểm tra từng sinh viên, nhập email trường rồi bấm **Duyệt & cấp mã**. Backend sinh mã `S[A-P]YYNNNNN`, tạo tài khoản và gửi email kích hoạt đến email trường. Hồ sơ bị từ chối không tạo tài khoản.

Email cá nhân trùng được báo lỗi theo dòng. Chỉ nhập lại những dòng lỗi sau khi sửa; các dòng thành công đã nằm trong danh sách chờ duyệt. Không cần Apps Script hoặc webhook.
