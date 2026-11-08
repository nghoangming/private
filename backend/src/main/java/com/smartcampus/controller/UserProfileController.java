package com.smartcampus.controller;

import com.smartcampus.auth.AccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/users")
public class UserProfileController {
    private final JdbcTemplate jdbc;
    private final AccessService access;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    public UserProfileController(JdbcTemplate jdbc, AccessService access) { this.jdbc = jdbc; this.access = access; }

    public record Profile(Long id, String code, String name, String email, String faculty, List<String> roles) { }
    public record UpdateProfile(@NotBlank @Size(max = 100) String name) { }
    public record ChangePassword(@NotBlank String currentPassword, @NotBlank @Size(min = 8) String newPassword) { }
    public record AdminUser(Long id, String code, String name, String email, String faculty, String role, boolean verified) { }
    public record UpdateFaculty(@NotBlank @Size(max = 100) String faculty) { }

    @GetMapping
    public List<AdminUser> users(@RequestAttribute("authenticatedUserId") Long adminId,
                                 @RequestParam(required = false) String faculty) {
        access.requireRole(adminId, "ADMIN");
        String sql = """
            SELECT u.user_id, u.user_code, u.full_name, u.email, u.faculty, r.role_name, u.email_verified
            FROM users u JOIN user_roles ur ON ur.user_id = u.user_id
            JOIN roles r ON r.role_id = ur.role_id
            """ + (faculty == null || faculty.isBlank() ? "" : " WHERE u.faculty = ?") + " ORDER BY u.user_id";
        return jdbc.query(sql, (rs, n) -> new AdminUser(rs.getLong(1), rs.getString(2), rs.getString(3),
                rs.getString(4), rs.getString(5), rs.getString(6), rs.getBoolean(7)),
                faculty == null || faculty.isBlank() ? new Object[0] : new Object[] { faculty });
    }

    @PatchMapping("/{id}/faculty")
    public Profile setFaculty(@PathVariable Long id,
                              @RequestAttribute("authenticatedUserId") Long adminId,
                              @Valid @RequestBody UpdateFaculty request) {
        access.requireRole(adminId, "ADMIN");
        access.requireRole(id, "STUDENT");
        jdbc.update("UPDATE users SET faculty = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?", request.faculty().trim(), id);
        return profile(id);
    }

    @GetMapping("/me")
    public Profile me(@RequestAttribute("authenticatedUserId") Long userId) { return profile(userId); }

    @PatchMapping("/me")
    public Profile update(@RequestAttribute("authenticatedUserId") Long userId,
                          @Valid @RequestBody UpdateProfile request) {
        jdbc.update("UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?", request.name().trim(), userId);
        return profile(userId);
    }

    @PostMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@RequestAttribute("authenticatedUserId") Long userId,
                               @Valid @RequestBody ChangePassword request) {
        List<String> hashes = jdbc.query("SELECT password_hash FROM users WHERE user_id = ?", (rs, n) -> rs.getString(1), userId);
        if (hashes.isEmpty() || !passwords.matches(request.currentPassword(), hashes.getFirst()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mật khẩu hiện tại không đúng.");
        if (request.currentPassword().equals(request.newPassword()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mật khẩu mới phải khác mật khẩu cũ.");
        jdbc.update("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
                passwords.encode(request.newPassword()), userId);
    }

    @GetMapping("/{id}/public")
    public Profile publicTeacher(@PathVariable Long id) {
        access.requireRole(id, "TEACHER");
        return profile(id);
    }

    private Profile profile(Long id) {
        List<Profile> rows = jdbc.query("SELECT user_id, user_code, full_name, email, faculty FROM users WHERE user_id = ?",
                (rs, n) -> new Profile(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getString(5), jdbc.query("SELECT r.role_name FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = ?", (r, i) -> r.getString(1), id)), id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản.");
        return rows.getFirst();
    }
}
