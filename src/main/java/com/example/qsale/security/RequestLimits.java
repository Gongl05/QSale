package com.example.qsale.security;

import java.sql.Timestamp;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RequestLimits {
    private final JdbcTemplate jdbc;

    public Budget consume(String identity, int limit) {
        return jdbc.queryForObject("""
                INSERT INTO security_rate_buckets (bucket_key, hits, expires_at)
                VALUES (?, 1, CURRENT_TIMESTAMP + INTERVAL '60 seconds')
                ON CONFLICT (bucket_key) DO UPDATE SET
                  hits = CASE WHEN security_rate_buckets.expires_at <= CURRENT_TIMESTAMP THEN 1
                         ELSE LEAST(security_rate_buckets.hits + 1, ?) END,
                  expires_at = CASE WHEN security_rate_buckets.expires_at <= CURRENT_TIMESTAMP
                               THEN CURRENT_TIMESTAMP + INTERVAL '60 seconds' ELSE security_rate_buckets.expires_at END
                RETURNING hits, expires_at
                """, (rs, row) -> new Budget(rs.getInt(1) <= limit,
                    Math.max(1, rs.getTimestamp(2).toInstant().getEpochSecond() - Instant.now().getEpochSecond())),
                SecurityKeys.hash(identity), limit + 1);
    }

    @Scheduled(fixedDelay = 3600000)
    public void cleanup() {
        Timestamp before = Timestamp.from(Instant.now().minusSeconds(86400));
        jdbc.update("DELETE FROM security_rate_buckets WHERE expires_at < ?", before);
        jdbc.update("DELETE FROM login_guards WHERE last_failure_at < ? AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)", before);
    }

    public record Budget(boolean allowed, long retryAfter) {}
}
