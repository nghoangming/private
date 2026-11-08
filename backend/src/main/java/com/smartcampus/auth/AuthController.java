package com.smartcampus.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final JdbcTemplate jdbc;
    private final JwtService jwt;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    public AuthController(JdbcTemplate jdbc, JwtService jwt) { this.jdbc = jdbc; this.jwt = jwt; }

    public record LoginRequest(@NotBlank String email, @NotBlank String password) { }
    public record LoginResponse(String accessToken, Instant expiresAt, Long id, String name, String email, List<String> roles) { }
    private record User(long id, String name, String email, String passwordHash) { }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        List<User> users = jdbc.query("""
            SELECT user_id, full_name, email, password_hash FROM users WHERE lower(email) = lower(?) AND email_verified = TRUE
            """, (rs, row) -> new User(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4)), request.email().trim());
        if (users.isEmpty() || !passwords.matches(request.password(), users.getFirst().passwordHash()))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email hoặc mật khẩu không đúng.");
        User user = users.getFirst();
        List<String> roles = jdbc.query("""
            SELECT r.role_name FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
            WHERE ur.user_id = ? ORDER BY r.role_name
            """, (rs, row) -> rs.getString(1), user.id());
        JwtService.IssuedToken token = jwt.issue(user.id());
        return new LoginResponse(token.value(), token.expiresAt(), user.id(), user.name(), user.email(), roles);
    }
}
