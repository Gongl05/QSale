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
import java.util.List;

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
    private List<LocalDate> tentativeDates;
    // The agreed day and place once the plan is confirmed (null while it is open).
    private LocalDateTime agreedStartsAt;
    private LocalDateTime agreedEndsAt;
    private LocalDate agreedStartsOn;
    private LocalDate agreedEndsOn;
    private String agreedPlace;
    private String agreedAddress;
    private String creatorName;
    private String creatorNickname;
    private LocalDateTime createdAt;
    private ParticipantRole currentUserRole;
    private ParticipationStatus currentUserParticipationStatus;
    private Long currentUserOriginAddressId;
    // First people who joined (for the faces on a plan card) and how many joined in total.
    private List<PlanMemberDto> members;
    private int joinedCount;
    private int agreementVersion;
}
