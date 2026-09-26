package com.example.qsale.plan.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class PlanDetailDto extends PlanResponseDto {
    private String description;
    private String inviteCode;
    private Long creatorId;
    private LocalDateTime closedAt;
}
