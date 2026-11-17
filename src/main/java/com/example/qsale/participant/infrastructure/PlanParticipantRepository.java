package com.example.qsale.participant.infrastructure;

import com.example.qsale.participant.domain.ParticipationStatus;
import com.example.qsale.participant.domain.PlanParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PlanParticipantRepository extends JpaRepository<PlanParticipant, Long> {

    Optional<PlanParticipant> findByPlanIdAndUserId(Long planId, Long userId);

    boolean existsByPlanIdAndUserId(Long planId, Long userId);

    List<PlanParticipant> findByPlanId(Long planId);

    List<PlanParticipant> findByUserIdAndStatus(Long userId, ParticipationStatus status);

    List<PlanParticipant> findByUserIdAndPlanIdIn(Long userId, List<Long> planIds);

    long countByPlanId(Long planId);

    long countByPlanIdAndStatus(Long planId, ParticipationStatus status);

    List<PlanParticipant> findByOriginAddressId(Long originAddressId);

    @Query("select count(mine) > 0 from PlanParticipant mine, PlanParticipant theirs "
            + "where mine.plan = theirs.plan and mine.user.id = :userId and theirs.user.id = :otherUserId")
    boolean shareAPlan(@Param("userId") Long userId, @Param("otherUserId") Long otherUserId);
}
