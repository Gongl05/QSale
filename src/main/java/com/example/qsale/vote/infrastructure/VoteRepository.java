package com.example.qsale.vote.infrastructure;

import com.example.qsale.vote.domain.Vote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VoteRepository extends JpaRepository<Vote, Long> {

    boolean existsByOptionIdAndUserId(Long optionId, Long userId);

    Optional<Vote> findByOptionIdAndUserId(Long optionId, Long userId);

    long countByOptionId(Long optionId);

    long deleteByOption_Plan_IdAndUser_Id(Long planId, Long userId);
}
