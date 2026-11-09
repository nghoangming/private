package com.smartcampus.service;

import com.smartcampus.service.UserInvitationService.InviteRequest;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StudentIntakeService {
    private static final List<String> FACULTIES = List.of(
            "Công nghệ thông tin", "Dược", "Điện - Điện tử", "Kế toán",
            "Khoa học thể thao", "Khoa học ứng dụng", "Ngoại ngữ", "Kỹ thuật công trình",
            "Luật", "Mỹ thuật công nghiệp", "Quản trị kinh doanh", "Lao động và Công đoàn",
            "Khoa học xã hội và Nhân văn", "Môi trường - Bảo hộ lao động",
            "Tài chính - Ngân hàng", "Toán - Thống kê");
    private final JdbcTemplate jdbc;
    private final UserInvitationService invitations;
    public StudentIntakeService(JdbcTemplate jdbc, UserInvitationService invitations) {
        this.jdbc = jdbc; this.invitations = invitations;
    }
    public record Submission(String name, String phone, LocalDate birthDate, String gender,
            String personalEmail, String facultyCode) { }
    public record Intake(Long id, String name, String phone, LocalDate birthDate, String gender,
            String personalEmail, String facultyCode, String faculty, String status,
            Long userId, OffsetDateTime createdAt) { }

    public Intake submit(Submission form) {
        if (form == null || blank(form.name()) || form.name().length() > 100
                || blank(form.personalEmail()) || form.personalEmail().length() > 100
                || !form.personalEmail().trim().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
                || blank(form.facultyCode())
                || form.facultyCode().length() != 1 || form.facultyCode().charAt(0) < 'A'
                || form.facultyCode().charAt(0) > 'P' || (form.phone() != null && form.phone().length() > 20)
                || (form.gender() != null && !List.of("MALE", "FEMALE", "OTHER").contains(form.gender())))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thông tin đăng ký không hợp lệ.");
        try {
            Long id = jdbc.queryForObject("""
                INSERT INTO student_intake(full_name,phone,birth_date,gender,personal_email,faculty_code)
                VALUES (?,?,?,?,?,?) RETURNING intake_id
                """, Long.class, form.name().trim(), form.phone(), form.birthDate(), form.gender(),
                    form.personalEmail().trim().toLowerCase(Locale.ROOT), form.facultyCode());
            return get(id);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email cá nhân đã gửi hồ sơ.", ex);
        }
    }

    public List<Intake> list() { return jdbc.query("""
        SELECT intake_id,full_name,phone,birth_date,gender,personal_email,faculty_code,status,user_id,created_at
        FROM student_intake ORDER BY created_at DESC, intake_id DESC
        """, (rs, n) -> map(rs)); }

    @Transactional
    public Intake approve(Long id, String schoolEmail, Long adminId) {
        if (blank(schoolEmail) || !schoolEmail.trim().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cần email trường hợp lệ để tạo tài khoản.");
        List<Intake> rows = jdbc.query("""
            SELECT intake_id,full_name,phone,birth_date,gender,personal_email,faculty_code,status,user_id,created_at
            FROM student_intake WHERE intake_id = ? FOR UPDATE
            """, (rs, n) -> map(rs), id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hồ sơ.");
        Intake row = rows.getFirst();
        if (!"PENDING".equals(row.status())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Hồ sơ đã được xử lý.");
        String year = String.format("%02d", LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).getYear() % 100);
        Integer number = jdbc.queryForObject("""
            INSERT INTO student_code_sequence(faculty_code,code_year,next_number) VALUES (?,?,2)
            ON CONFLICT (faculty_code,code_year) DO UPDATE
              SET next_number = student_code_sequence.next_number + 1
            RETURNING next_number - 1
            """, Integer.class, row.facultyCode(), year);
        if (number == null || number > 99999) throw new ResponseStatusException(HttpStatus.CONFLICT, "Đã hết mã cho khoa và năm này.");
        String code = "S" + row.facultyCode() + year + String.format("%05d", number);
        var invited = invitations.invite(new InviteRequest(code, row.name(), schoolEmail.trim(), "STUDENT", row.faculty()), adminId);
        jdbc.update("""
            UPDATE users SET phone=?, birth_date=?, personal_email=?, gender=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?
            """, row.phone(), row.birthDate(), row.personalEmail(), row.gender(), invited.id());
        jdbc.update("UPDATE student_intake SET status='APPROVED', user_id=?, reviewed_at=CURRENT_TIMESTAMP WHERE intake_id=?", invited.id(), id);
        return get(id);
    }

    public Intake reject(Long id) {
        int changed = jdbc.update("UPDATE student_intake SET status='REJECTED', reviewed_at=CURRENT_TIMESTAMP WHERE intake_id=? AND status='PENDING'", id);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Hồ sơ không còn chờ duyệt.");
        return get(id);
    }

    private Intake get(Long id) { return jdbc.queryForObject("""
        SELECT intake_id,full_name,phone,birth_date,gender,personal_email,faculty_code,status,user_id,created_at
        FROM student_intake WHERE intake_id=?
        """, (rs, n) -> map(rs), id); }
    private Intake map(java.sql.ResultSet rs) throws java.sql.SQLException {
        String letter = rs.getString(7);
        return new Intake(rs.getLong(1),rs.getString(2),rs.getString(3),rs.getObject(4,LocalDate.class),
                rs.getString(5),rs.getString(6),letter,FACULTIES.get(letter.charAt(0)-'A'),rs.getString(8),
                rs.getObject(9,Long.class),rs.getObject(10,OffsetDateTime.class));
    }
    private boolean blank(String value) { return value == null || value.isBlank(); }
}
