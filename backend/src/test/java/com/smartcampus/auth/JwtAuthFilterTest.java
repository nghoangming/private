package com.smartcampus.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.ObjectMapper;

class JwtAuthFilterTest {
    private final JwtService jwt = new JwtService("test-secret-with-at-least-thirty-two-characters", new ObjectMapper());
    private final JwtAuthFilter filter = new JwtAuthFilter(jwt);

    @Test
    void rejectsSpoofedUserHeaderWithoutBearerToken() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/seat-reservations");
        request.addHeader("X-Demo-User-Id", "1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> { throw new AssertionError("Request must be rejected"); });
        assertEquals(401, response.getStatus());
        assertNull(request.getAttribute("authenticatedUserId"));
    }

    @Test
    void usesSignedJwtSubjectAsIdentity() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/seat-reservations");
        request.addHeader("X-Demo-User-Id", "1");
        request.addHeader("Authorization", "Bearer " + jwt.issue(42).value());
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> assertEquals(42L, req.getAttribute("authenticatedUserId"));
        filter.doFilter(request, response, chain);
        assertEquals(200, response.getStatus());
    }
}
