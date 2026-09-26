package com.example.qsale.plan.dto;

import java.util.List;

public record PlanPageResponseDto(
        List<PlanResponseDto> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}
