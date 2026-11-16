package com.example.qsale.auth.domain;

import com.example.qsale.security.SecurityKeys;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.infrastructure.UserRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class LoginProtectionService {
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final String dummyHash;

    public LoginProtectionService(JdbcTemplate jdbc, UserRepository users, PasswordEncoder passwords) {
        this.jdbc = jdbc; this.users = users; this.passwords = passwords;
        this.dummyHash = passwords.encode(UUID.randomUUID().toString());
    }

    // The independent transaction commits failed attempts even when the caller rejects login.
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = AuthenticationException.class)
    public User authenticate(String email, String password) {
        String key = SecurityKeys.hash("login:" + email);
        Instant now = Instant.now();
        jdbc.update("INSERT INTO login_guards (account_key, failures, last_failure_at) VALUES (?, 0, ?) ON CONFLICT DO NOTHING",
                key, Timestamp.from(now));
        Attempt attempt = jdbc.queryForObject("SELECT failures, last_failure_at, locked_until FROM login_guards WHERE account_key = ? FOR UPDATE",
                (rs, row) -> new Attempt(rs.getInt(1), rs.getTimestamp(2).toInstant(),
                        rs.getTimestamp(3) == null ? null : rs.getTimestamp(3).toInstant()), key);
        if (attempt.lockedUntil() != null && attempt.lockedUntil().isAfter(now)) {
            log.warn("security_event=login_blocked account={}", key.substring(0, 12));
            throw rejected();
        }
        int previous = attempt.lastFailure().isBefore(now.minusSeconds(900)) || attempt.lockedUntil() != null
                ? 0 : attempt.failures();
        User user = users.findByEmail(email).orElse(null);
        boolean valid = passwords.matches(password, user == null ? dummyHash : user.getPassword());
        if (user == null || !valid) {
            int failures = previous + 1;
            Instant lockedUntil = failures >= 5 ? now.plusSeconds(900) : null;
            jdbc.update("UPDATE login_guards SET failures = ?, last_failure_at = ?, locked_until = ? WHERE account_key = ?",
                    failures, Timestamp.from(now), lockedUntil == null ? null : Timestamp.from(lockedUntil), key);
            log.warn("security_event={} account={} failures={}",
                    lockedUntil == null ? "login_failed" : "login_lockout_alert", key.substring(0, 12), failures);
            throw rejected();
        }
        jdbc.update("UPDATE login_guards SET failures = 0, locked_until = NULL WHERE account_key = ?", key);
        if (passwords.upgradeEncoding(user.getPassword())) {
            String upgraded = passwords.encode(password);
            jdbc.update("UPDATE users SET password = ? WHERE id = ? AND password = ?", upgraded, user.getId(), user.getPassword());
        }
        return user;
    }

    private BadCredentialsException rejected() { return new BadCredentialsException("Invalid email or password"); }
    private record Attempt(int failures, Instant lastFailure, Instant lockedUntil) {}
}
