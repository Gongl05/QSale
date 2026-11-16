package com.example.qsale.auth.infrastructure;

import com.example.qsale.auth.domain.AuthSession;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface AuthSessionRepository extends JpaRepository<AuthSession, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from AuthSession s join fetch s.user where s.id = :id")
    Optional<AuthSession> findForUpdate(@Param("id") String id);

    boolean existsByIdAndUserEmailAndRevokedAtIsNullAndExpiresAtAfter(String id, String email, Instant now);

    void deleteByExpiresAtBefore(Instant now);

    @Modifying
    @Query("update AuthSession s set s.revokedAt = :now where s.user.id = :userId and s.revokedAt is null")
    int revokeForUser(@Param("userId") Long userId, @Param("now") Instant now);
}
