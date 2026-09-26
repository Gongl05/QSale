package com.example.qsale.commitment.infrastructure;

import com.example.qsale.commitment.domain.CommitmentResponse;
import com.example.qsale.commitment.domain.CommitmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CommitmentResponseRepository extends JpaRepository<CommitmentResponse, Long> {

    Optional<CommitmentResponse> findByPlanIdAndUserId(Long planId, Long userId);

    List<CommitmentResponse> findByPlanId(Long planId);

    long countByPlanIdAndStatus(Long planId, CommitmentStatus status);

    long deleteByPlanIdAndUserId(Long planId, Long userId);
}
