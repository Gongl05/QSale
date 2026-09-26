package com.example.qsale.plan.dto;

import com.example.qsale.plan.domain.FeasibilityStatus;

public record FeasibilityResponseDto(
        Long planId,
        Integer score,
        FeasibilityStatus status,
        long confirmedParticipants,
        Integer minParticipants,
        long totalParticipants
) {
}
