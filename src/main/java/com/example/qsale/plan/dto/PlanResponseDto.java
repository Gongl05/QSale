package com.example.qsale.plan.dto;

import com.example.qsale.plan.domain.FeasibilityStatus;
import com.example.qsale.plan.domain.PlanStatus;
import com.example.qsale.plan.domain.PlanType;
import com.example.qsale.participant.domain.ParticipantRole;
import com.example.qsale.participant.domain.ParticipationStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class PlanResponseDto {
    private Long id;
    private Long version;
    private String name;
    private PlanType type;
    private PlanStatus status;
    private FeasibilityStatus feasibilityStatus;
    private Integer feasibilityScore;
    private Integer minParticipants;
    private Double budget;
    private LocalDate tentativeStartDate;
    private LocalDate tentativeEndDate;
    private String creatorName;
    private LocalDateTime createdAt;
    private ParticipantRole currentUserRole;
    private ParticipationStatus currentUserParticipationStatus;
    private int agreementVersion;
    private AgreementDto agreement;
}
