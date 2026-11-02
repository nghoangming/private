package com.smartcampus.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import tools.jackson.databind.ObjectMapper;

class JwtServiceTest {
    private final JwtService jwt = new JwtService("test-secret-with-at-least-thirty-two-characters", new ObjectMapper());

    @Test
    void issuedTokenIdentifiesUserAndRejectsTampering() {
        String token = jwt.issue(42).value();
        assertEquals(42, jwt.verify(token));
        String[] parts = token.split("\\.");
        assertThrows(IllegalArgumentException.class, () -> jwt.verify(parts[0] + "." + parts[1] + ".invalid"));
        assertThrows(IllegalArgumentException.class, () -> jwt.verify("not-a-token"));
    }

    @Test
    void seededPasswordsMatchStoredBcryptHashes() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        assertTrue(encoder.matches("Admin@123", "$2a$10$48PFqODW9Q4032olxkmfF.b8VMeBb0n4ZiWHGItxChltfttwo613C"));
        assertTrue(encoder.matches("Teacher@123", "$2a$10$CfBEHolwhpQ54ZVKmhX7a.iT8t9C..orIxQi8NIZjYUGZYnFvdXdu"));
        assertTrue(encoder.matches("Student@123", "$2a$10$ZKEKKxUF533j3X8PuWKr5.QmOztpKGlJjnHlpuNQD8ktdgeNNi3rW"));
    }
}
