package com.smartcampus.service;

import com.smartcampus.auth.AccessService;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserInvitationServiceTest {
    @Test
    void sendsStudentActivationToPersonalEmailButKeepsSchoolEmailForLogin() {
        JdbcTemplate jdbc = new JdbcTemplate() {
            @Override public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
                return requiredType.cast(12L);
            }
            @Override public int update(String sql, Object... args) { return 1; }
        };
        AccessService access = new AccessService(jdbc) {
            @Override public void requireRole(Long userId, String role) {
                assertEquals(1L, userId);
                assertEquals("ADMIN", role);
            }
        };
        AtomicReference<SimpleMailMessage> sent = new AtomicReference<>();
        JavaMailSenderImpl mail = new JavaMailSenderImpl() {
            @Override public void send(SimpleMailMessage message) { sent.set(message); }
        };
        var service = new UserInvitationService(jdbc, access, mail,
                "smartcampussystem@gmail.com", "configured", "http://localhost:3000");
        var result = service.inviteTo(new UserInvitationService.InviteRequest(
                "SI2300001", "Nguyễn Văn Tâm", "si2300001@smartcampus.test", "STUDENT", "Luật"),
                1L, "nvtam000@gmail.com");
        assertEquals("si2300001@smartcampus.test", result.email());
        assertEquals("nvtam000@gmail.com", sent.get().getTo()[0]);
        assertTrue(sent.get().getText().contains("si2300001@smartcampus.test"));
    }
}
