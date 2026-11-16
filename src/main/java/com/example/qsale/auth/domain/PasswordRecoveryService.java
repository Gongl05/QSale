package com.example.qsale.auth.domain;

import com.example.qsale.auth.infrastructure.AuthSessionRepository;
import com.example.qsale.auth.infrastructure.PasswordResetRepository;
import com.example.qsale.exceptions.ExternalServiceException;
import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.jobs.BackgroundQueue;
import com.example.qsale.jobs.JobPayload;
import com.example.qsale.notification.domain.EmailService;
import com.example.qsale.notification.domain.PublicLinks;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.infrastructure.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PasswordRecoveryService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final UserRepository users;
    private final PasswordResetRepository resets;
    private final AuthSessionRepository sessions;
    private final PasswordEncoder encoder;
    private final BackgroundQueue queue;
    private final EmailService email;
    private final PublicLinks links;
    private final Map<String, Instant> recentRequests = new HashMap<>();

    @Transactional
    public void request(String emailAddress) {
        String normalized = emailAddress.strip().toLowerCase(Locale.ROOT);
        String key = hash(normalized);
        Instant now = Instant.now();
        synchronized (recentRequests) {
            recentRequests.entrySet().removeIf(entry -> entry.getValue().isBefore(now.minusSeconds(3600)));
            Instant previous = recentRequests.get(key);
            if ((previous != null && previous.isAfter(now.minusSeconds(60))) || recentRequests.size() >= 10000) return;
            recentRequests.put(key, now);
        }
        // Account lookup and delivery happen in the worker for the same public response path.
        queue.enqueue("PASSWORD_RECOVERY", new JobPayload(null, null, normalized, null, null, null));
    }

    @Transactional
    public void deliverRequest(String emailAddress) {
        Optional<User> account = users.findForUpdateByEmail(emailAddress);
        if (account.isEmpty()) return;
        User user = account.get();
        Instant now = Instant.now();
        PasswordReset reset = resets.findForUpdate(user.getId()).orElseGet(() -> {
            PasswordReset value = new PasswordReset();
            value.setUser(user);
            value.setWindowStartedAt(now);
            return value;
        });
        if (reset.getIssuedAt() != null && reset.getIssuedAt().isAfter(now.minusSeconds(60))) return;
        if (!reset.getWindowStartedAt().isAfter(now.minusSeconds(3600))) {
            reset.setWindowStartedAt(now);
            reset.setRequestsInWindow(0);
        }
        if (reset.getRequestsInWindow() >= 3) return;
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        reset.setTokenHash(hash(token));
        reset.setIssuedAt(now);
        reset.setExpiresAt(now.plusSeconds(1200));
        reset.setUsedAt(null);
        reset.setRequestsInWindow(reset.getRequestsInWindow() + 1);
        resets.save(reset);
        // The durable job holds only the address; the raw token exists only during delivery.
        if (!email.sendHtmlEmail(user.getEmail(), "Recupera tu cuenta de Quesale", "email/password-reset",
                Map.of("name", user.getName(), "actionUrl", links.passwordReset(token), "logoUrl", links.logo()))) {
            throw new ExternalServiceException("Password recovery email could not be delivered");
        }
    }

    @Transactional
    public void confirm(String token, String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new InvalidOperationException("Password must not exceed 72 UTF-8 bytes");
        }
        String tokenHash = hash(token);
        Long userId = resets.findUserIdByTokenHash(tokenHash).orElseThrow(this::invalidLink);
        User user = users.findForUpdateById(userId).orElseThrow(this::invalidLink);
        PasswordReset reset = resets.findForUpdate(userId).orElseThrow(this::invalidLink);
        Instant now = Instant.now();
        if (reset.getUsedAt() != null || !reset.getExpiresAt().isAfter(now)
                || !MessageDigest.isEqual(reset.getTokenHash().getBytes(StandardCharsets.US_ASCII),
                tokenHash.getBytes(StandardCharsets.US_ASCII))) throw invalidLink();
        user.setPassword(encoder.encode(password));
        reset.setUsedAt(now);
        sessions.revokeForUser(userId, now);
        queue.enqueue("EMAIL", new JobPayload(null, null, user.getEmail(), "Contraseña actualizada en Quesale",
                "email/password-changed", Map.of("name", user.getName(), "actionUrl", links.plans(), "logoUrl", links.logo())));
    }

    private InvalidOperationException invalidLink() {
        return new InvalidOperationException("This recovery link is invalid or expired");
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("SHA-256 is unavailable", unavailable);
        }
    }
}
