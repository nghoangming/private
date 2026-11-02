package com.smartcampus.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
public class JwtService {
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();
    private final byte[] secret;
    private final ObjectMapper mapper;

    public JwtService(@Value("${app.jwt.secret}") String secret, ObjectMapper mapper) {
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32)
            throw new IllegalArgumentException("JWT_SECRET must contain at least 32 UTF-8 bytes");
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.mapper = mapper;
    }

    public record IssuedToken(String value, Instant expiresAt) { }

    public IssuedToken issue(long userId) {
        Instant expiresAt = Instant.now().plusSeconds(3600);
        String header = encode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        String payload = encode("{\"sub\":\"" + userId + "\",\"iss\":\"smart-campus\",\"exp\":" + expiresAt.getEpochSecond() + "}");
        String signed = header + "." + payload;
        return new IssuedToken(signed + "." + ENCODER.encodeToString(sign(signed)), expiresAt);
    }

    public long verify(String token) {
        try {
            String[] parts = token.split("\\.", -1);
            if (parts.length != 3 || !MessageDigest.isEqual(sign(parts[0] + "." + parts[1]), DECODER.decode(parts[2])))
                throw new IllegalArgumentException("Invalid JWT signature");
            Map<?, ?> header = mapper.readValue(DECODER.decode(parts[0]), Map.class);
            Map<?, ?> claims = mapper.readValue(DECODER.decode(parts[1]), Map.class);
            if (!"HS256".equals(header.get("alg")) || !"smart-campus".equals(claims.get("iss")))
                throw new IllegalArgumentException("Invalid JWT claims");
            long expiry = ((Number) claims.get("exp")).longValue();
            if (Instant.now().getEpochSecond() >= expiry) throw new IllegalArgumentException("JWT expired");
            return Long.parseLong((String) claims.get("sub"));
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid or expired token", ex);
        }
    }

    private String encode(String value) { return ENCODER.encodeToString(value.getBytes(StandardCharsets.UTF_8)); }

    private byte[] sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.US_ASCII));
        } catch (Exception ex) { throw new IllegalStateException("Cannot sign JWT", ex); }
    }
}
