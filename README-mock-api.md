# FE ↔ BE mock, không cần PostgreSQL

Backend mock dùng Spring Boot và giữ dữ liệu trong bộ nhớ. Dừng backend sẽ xóa các lượt đặt phòng đã tạo.

Mở PowerShell tại `backend`:

```powershell
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.main-class=com.smartcampusmock.MockBackendApplication'
```

Mở PowerShell khác tại `frontend`:

```powershell
npm install
npm run dev
```

Truy cập `http://localhost:3000`. Next.js chuyển `/api/v1/*` tới `http://localhost:8080`.

Các endpoint mock hiện có: `GET /health`, `GET /rooms`, `GET /rooms/{id}`, `GET /rooms/{id}/schedule`, `GET /rooms/availability`, và `GET/POST/PATCH` cho `classroom-reservations` và `study-room-reservations`. Tạo phòng trùng thời gian trả HTTP 409. FE dùng các endpoint này cho tìm phòng và luồng đặt phòng của giảng viên/sinh viên. Các màn ghế, QR, tài nguyên, sự cố và thông báo vẫn dùng dữ liệu demo phía FE.
