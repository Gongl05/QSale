package com.example.qsale.auth.infrastructure;

import com.example.qsale.auth.domain.PasswordReset;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface PasswordResetRepository extends JpaRepository<PasswordReset, Long> {
    @Query("select r.userId from PasswordReset r where r.tokenHash = :hash")
    Optional<Long> findUserIdByTokenHash(@Param("hash") String hash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PasswordReset r where r.userId = :id")
    Optional<PasswordReset> findForUpdate(@Param("id") Long id);
}
