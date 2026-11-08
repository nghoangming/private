package com.smartcampus.service;

import com.smartcampus.auth.AccessService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserInvitationService {
    private final JdbcTemplate jdbc;
    private final AccessService access;
    private final JavaMailSender mail;
    private final String sender;
    private final String appPassword;
    private final String frontendUrl;
    private final SecureRandom random = new SecureRandom();
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    public UserInvitationService(JdbcTemplate jdbc, AccessService access, JavaMailSender mail,
            @Value("${spring.mail.username}") String sender,
            @Value("${spring.mail.password}") String appPassword,
            @Value("${app.frontend.url}") String frontendUrl) {
        this.jdbc = jdbc; this.access = access; this.mail = mail; this.sender = sender;
        this.appPassword = appPassword; this.frontendUrl = frontendUrl;
    }

    public record InviteRequest(String code, String name, String email, String role, String faculty) { }
    public record InviteResponse(Long id, String email, String role, String faculty) { }
    public record ActivateRequest(String token, String password) { }

    @Transactional
    public InviteResponse invite(InviteRequest request, Long adminId) {
        access.requireRole(adminId, "ADMIN");
        if (appPassword.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Chưa cấu hình SMTP_APP_PASSWORD.");
        if (request.code() == null || request.code().isBlank() || request.code().length() > 20
                || request.name() == null || request.name().isBlank() || request.name().length() > 100
                || request.email() == null || !request.email().contains("@") || request.email().length() > 100
                || request.role() == null || !List.of("STUDENT", "TEACHER").contains(request.role())
                || (request.faculty() != null && request.faculty().length() > 100)
                || ("STUDENT".equals(request.role()) && (request.faculty() == null || request.faculty().isBlank())))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thông tin tài khoản không hợp lệ.");
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        try {
            Long id = jdbc.queryForObject("""
                INSERT INTO users(user_code, full_name, email, password_hash, faculty, email_verified)
                VALUES (?, ?, ?, ?, ?, FALSE) RETURNING user_id
                """, Long.class, request.code().trim(), request.name().trim(), request.email().trim().toLowerCase(),
                passwords.encode(token), "STUDENT".equals(request.role()) ? request.faculty().trim() : null);
            jdbc.update("INSERT INTO user_roles(user_id, role_id) SELECT ?, role_id FROM roles WHERE role_name = ?", id, request.role());
            jdbc.update("INSERT INTO user_invites(user_id, token_hash, expires_at) VALUES (?, ?, ?)", id, hash(token), OffsetDateTime.now().plusHours(24));
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(sender); message.setTo(request.email().trim());
            message.setSubject("Kích hoạt tài khoản TDTU Smart Campus");
            message.setText("Xin chào " + request.name().trim() + ",\n\nMở liên kết sau để đặt mật khẩu và kích hoạt tài khoản (hiệu lực 24 giờ):\n"
                    + frontendUrl.replaceAll("/$", "") + "/activate?token=" + token + "\n\nNếu không yêu cầu tài khoản, hãy bỏ qua email này.");
            mail.send(message);
            return new InviteResponse(id, request.email().trim(), request.role(), request.faculty());
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mã tài khoản hoặc email đã tồn tại.", ex);
        }
    }

    @Transactional
    public void activate(ActivateRequest request) {
        if (request.token() == null || request.token().isBlank() || request.password() == null || request.password().length() < 8)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã xác thực hoặc mật khẩu không hợp lệ.");
        List<Long> ids = jdbc.query("""
            SELECT user_id FROM user_invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP FOR UPDATE
            """, (rs, n) -> rs.getLong(1), hash(request.token()));
        if (ids.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Liên kết xác thực đã hết hạn hoặc đã sử dụng.");
        Long id = ids.getFirst();
        jdbc.update("UPDATE users SET password_hash = ?, email_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?", passwords.encode(request.password()), id);
        jdbc.update("UPDATE user_invites SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL", id);
    }

    private String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception ex) { throw new IllegalStateException(ex); }
    }
}
