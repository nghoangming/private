package com.smartcampus.service;

import com.smartcampus.auth.AccessService;
import java.lang.reflect.Proxy;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class StudentIntakeCsvServiceTest {
    private final Map<String, String> faculties = Map.of(
            "luat", "I",
            "cong nghe thong tin", "A");

    @Test
    void acceptsGoogleFormFacultyNameAndExistingCodeFormat() {
        assertEquals("I", StudentIntakeCsvService.facultyCode("Luật", faculties));
        assertEquals("I", StudentIntakeCsvService.facultyCode("I - Luật", faculties));
        assertEquals("A", StudentIntakeCsvService.facultyCode("Công nghệ thông tin", faculties));
    }

    @Test
    void rejectsUnknownOrMismatchedFaculty() {
        assertThrows(IllegalArgumentException.class,
                () -> StudentIntakeCsvService.facultyCode("Khoa không tồn tại", faculties));
        assertThrows(IllegalArgumentException.class,
                () -> StudentIntakeCsvService.facultyCode("A - Luật", faculties));
    }

    @Test
    void readsCohortYearFromGoogleForm() {
        assertEquals(2023, StudentIntakeCsvService.parseEntryYear("2023"));
        assertThrows(IllegalArgumentException.class,
                () -> StudentIntakeCsvService.parseEntryYear("23"));
        assertThrows(IllegalArgumentException.class,
                () -> StudentIntakeCsvService.parseEntryYear("1999"));
    }

    @Test
    void importsGoogleFormRowAndCreatesAccountImmediately() throws Exception {
        JdbcTemplate jdbc = new JdbcTemplate() {
            @Override public void query(String sql, RowCallbackHandler handler) {
                ResultSet row = (ResultSet) Proxy.newProxyInstance(ResultSet.class.getClassLoader(),
                        new Class<?>[] { ResultSet.class }, (proxy, method, args) -> {
                            if (method.getName().equals("getString"))
                                return ((int) args[0]) == 1 ? "I" : "Luật";
                            throw new UnsupportedOperationException(method.getName());
                        });
                try { handler.processRow(row); }
                catch (java.sql.SQLException ex) { throw new RuntimeException(ex); }
            }
        };
        AccessService access = new AccessService(jdbc) {
            @Override public void requireRole(Long userId, String role) {
                assertEquals(1L, userId);
                assertEquals("ADMIN", role);
            }
        };
        AtomicReference<StudentIntakeService.Submission> submitted = new AtomicReference<>();
        StudentIntakeService intake = new StudentIntakeService(jdbc, null, "smartcampus.test") {
            @Override public Created register(Submission form, Long adminId) {
                submitted.set(form);
                var saved = new Intake(7L, form.name(), form.phone(), form.birthDate(), form.gender(),
                        form.personalEmail(), "I", "Luật", 2023, "APPROVED", 12L, null);
                return new Created(saved, "SI2300001", "si2300001@smartcampus.test");
            }
        };
        var file = new MockMultipartFile("file", "form.csv", "text/csv", (
                "Dấu thời gian,Họ và tên,Số điện thoại,Ngày sinh,Giới tính,Email cá nhân,Khoa,Năm vào trường\n"
                + "09/11/2026 14:41:31,Nguyễn Văn Tâm,0000000000,11/11/2005,Nam,nvtam000@gmail.com,Luật,2023\n"
        ).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var result = new StudentIntakeCsvService(intake, access, jdbc).importFile(file, 1L);
        assertEquals(1, result.imported());
        assertEquals(0, result.failed());
        assertEquals("SI2300001", result.rows().getFirst().code());
        assertEquals("si2300001@smartcampus.test", result.rows().getFirst().schoolEmail());
        assertEquals("I", submitted.get().facultyCode());
        assertEquals(2023, submitted.get().entryYear());
        assertEquals(LocalDate.of(2005, 11, 11), submitted.get().birthDate());
    }
}
