package com.example.qsale.plan.infrastructure;

import com.example.qsale.plan.domain.Plan;
import com.example.qsale.plan.domain.PlanStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.Optional;

public interface PlanRepository extends JpaRepository<Plan, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Plan p where p.id = :planId")
    Optional<Plan> findByIdForUpdate(@Param("planId") Long planId);

    Optional<Plan> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);

    Page<Plan> findByParticipantsUserId(Long userId, Pageable pageable);

    Page<Plan> findByParticipantsUserIdAndStatus(Long userId, PlanStatus status, Pageable pageable);
}
