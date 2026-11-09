# DB release candidate — 08/11/2026

## Resources cố định theo phòng — đã áp dụng trong file DB

Bộ nguồn hiện là **001–016**. Migration **016** bổ sung FK ghép `(resource_id,room_id)` từ incidents sang resources và index hỗ trợ. Một resource vẫn có nhiều incident; sự cố chung của phòng vẫn cho phép `resource_id = NULL`. Nếu dữ liệu cũ liên kết sai phòng, migration dừng và rollback, không tự chuyển thiết bị hoặc sửa lịch sử.

Seed **004** bổ sung 10 nhóm thiết bị cho A101/A102 (30 máy tính + 1 máy chiếu mỗi phòng), B201/B202 (1 máy chiếu + 2 micro mỗi phòng), C301/C302 (10 ổ cắm mỗi phòng). Không thêm ghế vào resources. Seed chỉ thêm nhóm còn thiếu theo phòng/tên/loại, không ghi đè quantity/status đã có; không thêm bảng kho, mượn trả hay di chuyển.

`quantity` là tổng thiết bị lắp đặt. Một máy hỏng: ghi incident có mô tả như “máy số 12”, không tự giảm quantity hoặc đổi cả nhóm sang BROKEN. `status` mô tả toàn nhóm; đây là quy ước sử dụng, không phải cơ chế kiểm kê từng thiết bị. Số lượng đang hoạt động không được tính tự động từ incident để tránh đếm trùng báo cáo.

Test resources được thêm vào file `tests/verify_reservation_constraints.sql` hiện có: nhiều incident cho cùng resource, sự cố không có resource, chặn INSERT/UPDATE sai phòng (kể cả chuyển resource đã có incident), quantity không âm và không tự thay đổi số lượng/trạng thái nhóm. Chỉ thêm một file migration mới, không thêm file test/tài liệu riêng cho resources.

**Triển khai CNPM:** chưa chạy vào DB thật. Nếu 001–015 đã có, chỉ áp dụng 016 sau backup và kiểm tra quan hệ sai phòng bằng truy vấn dưới. Khi cần dữ liệu mẫu trên DB hiện có, chỉ chạy khối INSERT resources trong 004; không chạy lại toàn bộ seed vì phần rooms cũ có cập nhật dữ liệu. Nếu kết quả preflight không rỗng, đối chiếu lịch sử để sửa đúng nghiệp vụ trước khi chạy 016:

```sql
SELECT i.incident_id,i.room_id AS incident_room,r.resource_id,r.room_id AS resource_room
FROM incidents i JOIN resources r USING(resource_id)
WHERE i.room_id<>r.room_id;
```

Rủi ro “incident resource khác phòng” trong phần lịch sử bên dưới đã được FK 016 xử lý. Không sửa backend/frontend; backend cần lọc danh sách resource theo phòng khi làm giao diện báo sự cố.

## Cập nhật giữ ghế đã được chấp thuận

Migration **015** bổ sung PENDING giữ 2 phút, confirm/cancel và view ghế theo buổi; xem [SEAT_HOLDS.md](SEAT_HOLDS.md). Bộ nguồn hiện là **001–015**. RESULT và log chạy mới bao gồm test giữ ghế, hai kết nối cạnh tranh và backup/restore. Phần lịch sử bên dưới nói 001–013 mô tả lần kiểm tra trước. Backend đã được hoàn tác theo yêu cầu, không có thay đổi source backend cho tính năng này; log backend cũ không chứng minh tích hợp giữ ghế. Mục rủi ro challenge khác booking được migration 014 bổ sung FK bảo vệ; các mục nghiệp vụ khác vẫn cần xem xét.

**Kết luận: schema RC kiểm chứng trên DB thử; chưa đạt nghiệm thu Auth/security toàn hệ thống.** Không chạy migration, sửa dữ liệu hoặc thử restore trên CNPM. Bộ SQL phát hành là `migrations/001` đến `013`, theo thứ tự tên file; `migrations.zip` có sẵn không được cập nhật, không dùng nó thay bộ SQL này.

## Đã sửa và xác nhận

| Vị trí | Lỗi / thay đổi |
|---|---|
| 009 | Tạo lại `chk_resources_quantity` đã có từ 007 làm chuỗi migration dừng. Bỏ lệnh trùng và thêm transaction. |
| 011 | Thiếu `app_current_user_id()` và `app_current_role()`. Thêm helper đọc context transaction, thiếu context trả NULL. |
| 011 | Policy tham chiếu `class_sessions.teacher_id` không tồn tại. JOIN booking, dùng `bookings.user_id` theo mô hình chủ booking hiện hành. Thêm transaction. |
| Tests | Mã phòng test cũ bị trigger 007 từ chối. Đổi sang tiền tố A/C, giữ nguyên các assertion. |
| 013 | Thêm 6 index cho FK/checkins, booking_seats, permission lookup và lịch sử đơn vắng; index đầy đủ bao phủ cả lịch sử mà partial index không bao phủ. |

`003` hiện không còn lỗi bọc SELECT bằng nháy; phần README cũ mô tả lỗi đó đã lỗi thời. Các sửa đổi 011 và file check-in đã tồn tại trước lượt làm này được giữ lại, chỉ bổ sung các sửa lỗi nêu trên.

## Bằng chứng

Xem `evidence/RESULT.txt`: lần chạy mới từ DB trống, toàn bộ migration 001–013, tests booking/ghế/check-in, kiểm tra FK, RLS và backup–restore đều PASS trên PostgreSQL 18. Các log trong cùng thư mục ghi SQL/constraint/index/policy và kết quả thực tế.

- `source-fingerprint.txt` và `restored-fingerprint.txt`: mọi bảng public có cùng số dòng/digest, mọi sequence cùng last_value/is_called.
- `source-integrity.log`, `restored-integrity.log`: kiểm tra FK orphan thực tế, constraint chưa validate và một số quan hệ chéo chưa được FK ghép bảo vệ.
- `release_rls.log`: kiểm tra SELECT notification bằng role NOSUPERUSER/NOBYPASSRLS, không sở hữu bảng; chỉ thấy notification của mình; thiếu context thấy 0 dòng. **Không chứng minh toàn bộ policy hoặc HTTP RBAC đã an toàn.**
- `release_query_plan.log`: 10.000 booking tổng hợp, truy vấn giao giờ dùng `idx_bookings_room_active_time`. Đây là kiểm tra chọn index trên dữ liệu thử, không phải cam kết latency production hay benchmark trước/sau.
- Backup custom-format và SHA256 được ghi trong RESULT. Backup chỉ chứa seed demo; không phải bản sao CNPM. Script giữ lại DB thử để kiểm tra, không tự xóa.
- Frontend: `npm ci --ignore-scripts`, `npm run build` PASS (TypeScript + Vite). Backend Java 25: 8/8 tests PASS, Hibernate validate thành công khi DB_URL trỏ DB thử; xem `evidence/backend-tests.log`. Lần chạy backend với cấu hình DB mặc định thất bại kết nối; không phải lỗi cú pháp Java.

Chạy lại trên PostgreSQL thử riêng, đã khởi động và có quyền tạo DB/role:

```powershell
.\database\scripts\Test-Release.ps1 -Port 55439
```

Script luôn tạo hai DB tên ngẫu nhiên mới, dừng khi lệnh lỗi. Dùng pgpass/PGPASSWORD của phiên nếu máy thử yêu cầu mật khẩu; không ghi mật khẩu vào repo. Backup mặc định ở thư mục TEMP; chép sang nơi lưu bền vững nếu cần giữ lâu. Không dùng trust authentication của cluster thử cho triển khai thực tế.

Server thử của lần này được dừng sau kiểm chứng; đường dẫn cluster giữ trong `evidence/local-server.txt`. Có thể khởi động lại bằng `pg_ctl -D <cluster> -l <cluster>/server.log -o "-p 55439 -h 127.0.0.1" -w start`, rồi chạy script. Hoặc chỉ định `-Port` của một server thử khác. Không mở cluster trust này ra mạng.

Đối với CNPM đã có schema, **không chạy lại 001–013**. Trước tiên kiểm kê migration đã áp dụng, backup DB thật, chạy preflight rồi chỉ chạy phần còn thiếu. Bản sửa 009/011 dành cho chuỗi nguồn; DB đã áp dụng những file này cần đối chiếu catalog trước, không chạy lại nguyên file có CREATE TABLE/CONSTRAINT.

## Điểm chặn Auth/security — báo để xem xét, chưa tự thay thiết kế

1. **Login đang mock:** `frontend/src/pages/Login.tsx` chỉ nhận `admin/admin123`. API bị comment; seed DB là `Admin@123`, `Teacher@123`, `Student@123`. Không thể dùng UI hiện tại để chứng minh BCrypt/DB login. `services/api.ts` dùng `/api/v1/auth/login`, đoạn comment lại dùng `/api/auth/login`; backend chưa có endpoint auth và chưa có Spring Security dependency.
2. **API chưa có authenticated identity/RBAC:** ReservationService và SeatReservationService gán user ID = 1. Route frontend không có auth guard; thay localStorage không tạo bảo mật. Cần quyết định phạm vi triển khai auth thật trước khi nghiệm thu security; không tự thêm JWT hay thay ma trận quyền trong lượt kiểm tra DB này.
3. **RLS chưa được backend nối context:** helper chỉ đọc `app.user_id`/`app.role`, không xác thực các giá trị. Backend phải lấy identity/role từ phiên đã xác thực và `set_config(..., true)` trong cùng transaction/connection với query; không tin role từ JSON hoặc SQL client. Tài khoản superuser, BYPASSRLS và thông thường chủ bảng có thể bypass RLS; cấu hình mặc định backend dùng postgres nên chưa được RLS bảo vệ.
4. Policy notification UPDATE cho phép đổi mọi cột miễn user_id vẫn là mình; policy absence review chưa khóa các cột nội dung/chủ đơn và chưa ép state transition/reviewer. Cần thống nhất dùng column grants, procedure hoặc service validation. Không tự giới hạn vì ảnh hưởng chức năng.
5. Audit log chưa có trigger/service tự ghi. Role thường không có policy INSERT audit/notification; cần quy định đường ghi tin cậy trước khi backend dùng role hạn chế. Không mở quyền rộng để demo chạy được.

## Các quyết định nghiệp vụ cần bạn xem xét

- Chủ booking được hiểu là giáo viên phụ trách session; schema chưa có teacher_id riêng. Nếu admin có thể đặt thay giáo viên, cần mô hình giáo viên riêng trước khi dùng policy duyệt vắng.
- Student có thể tạo đơn vắng cho bất kỳ session tồn tại theo policy hiện tại; chưa kiểm tra đăng ký học/chọn ghế. ADMIN có `CREATE_OWN_ABSENCE_REQUEST` nhưng INSERT policy không cho loại ADMIN. Giữ nguyên ma trận quyền, cần xác nhận ý định.
- `booking_seats` có thể liên kết ghế khác phòng; `incidents.resource_id` có thể thuộc phòng khác; `checkins.challenge_id` có thể thuộc booking khác khi ghi trực tiếp. Audit mới phát hiện các ca này, chưa tự bổ sung FK ghép làm thay đổi mô hình. Hàm submit check-in đi theo session đúng nhưng quyền ghi trực tiếp vẫn cần kiểm soát.
- CHECK cho resources.status cho phép NULL; trigger room_type bắt buộc A/B/C và tự ghi đè room_type nhập. Không tự đổi quy tắc này.
- `lower(email)`/`lower(user_code)` hiện là index thường, không bảo đảm unique không phân biệt hoa thường. Nếu login tương lai không phân biệt hoa thường, cần kiểm tra trùng rồi quyết định unique index.
- RoomService.getAvailableRooms hiện có N+1 query theo số phòng; index không loại bỏ số round-trip. Cân nhắc một truy vấn NOT EXISTS và phân trang khi dữ liệu lớn. `idx_resources_room_id` có khả năng dư với `(room_id,status)`; chưa xóa khi chưa có số liệu workload.
- Các bảng ít dữ liệu/đang rỗng chỉ được kiểm tra cấu trúc hoặc fixture có sẵn. PASS integrity không chứng minh mọi transition nghiệp vụ. Seed booking cố định 16/10/2026; demo check-in dùng fixture theo giờ hiện tại.
- DB URL mặc định backend là `smart_campus`, README cũ nói CNPM. Đặt DB_URL rõ khi chạy; Java mặc định máy là 8, project cần Java 25. Không tự đổi DB mặc định để tránh trỏ nhầm dữ liệu.

## Tiêu chí phát hành

Schema/backup trên DB thử: đạt. Dữ liệu CNPM thật: chưa kiểm tra trong lượt này. HTTP authentication/authorization: chưa đạt vì chưa triển khai. Chỉ nghiệm thu Final DB/security sau khi quyết định các mục trên và kiểm thử 401/403, ownership, role escalation, context connection-pool và audit trên ứng dụng đã tích hợp.
