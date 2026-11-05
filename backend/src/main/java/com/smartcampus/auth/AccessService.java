package com.smartcampus.auth;

import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccessService {
    private final JdbcTemplate jdbc;

    public AccessService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean hasRole(Long userId, String role) {
        Integer count = jdbc.queryForObject("""
                SELECT count(*) FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
                WHERE ur.user_id = ? AND r.role_name = ?
                """, Integer.class, userId, role);
        return count != null && count > 0;
    }

    public void requireRole(Long userId, String role) {
        if (!hasRole(userId, role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Requires " + role + " role");
        }
    }

    public void requireOwnerOrAdmin(Long userId, Long ownerId) {
        if (!Objects.equals(userId, ownerId) && !hasRole(userId, "ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your reservation");
        }
    }
}
