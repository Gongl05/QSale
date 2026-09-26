package com.example.qsale.participant.infrastructure;

import com.example.qsale.participant.domain.ParticipationStatus;
import com.example.qsale.participant.domain.PlanParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlanParticipantRepository extends JpaRepository<PlanParticipant, Long> {

    Optional<PlanParticipant> findByPlanIdAndUserId(Long planId, Long userId);

    boolean existsByPlanIdAndUserId(Long planId, Long userId);

    List<PlanParticipant> findByPlanId(Long planId);

    List<PlanParticipant> findByUserIdAndStatus(Long userId, ParticipationStatus status);

    long countByPlanId(Long planId);

    long countByPlanIdAndStatus(Long planId, ParticipationStatus status);
}
