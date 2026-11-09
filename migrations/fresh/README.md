# Khởi tạo database mới

Thư mục này là bản schema cuối cùng đã gộp từ các migration lịch sử `001`–`016`. Chỉ dùng cho **database trống**. Không chạy tiếp các file `001`–`016` ở thư mục cha sau khi chạy bản này.

1. Dừng backend, kết nối pgAdmin vào database `postgres` (không kết nối `smart_campus`). Xóa database `smart_campus` cũ rồi tạo lại. Thao tác xóa phải chạy riêng, ngoài transaction.
2. Mở Query Tool của database `smart_campus` mới. Chạy toàn bộ `001_schema.sql` một lần.
3. Nếu cần tài khoản, phòng và chỗ ngồi mẫu, chạy tiếp `002_demo_seed.sql`. Dữ liệu đặt phòng mẫu trong file seed nằm ở ngày 16/10/2026; chúng không tự xuất hiện trong lịch hiện tại.
4. Khởi động backend với `DB_PASSWORD`, `JWT_SECRET` và `SMTP_APP_PASSWORD` theo cấu hình môi trường hiện có. Backend dùng `spring.jpa.hibernate.ddl-auto=validate` để kiểm tra schema.

Sau khi đã khởi tạo bằng baseline này, các thay đổi schema trong tương lai phải là migration mới (từ `017` trở đi), không sửa lại baseline của database đang chạy.
