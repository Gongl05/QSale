package com.example.qsale.participant.dto;

import com.example.qsale.participant.domain.ParticipantRole;
import com.example.qsale.participant.domain.ParticipationStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class ParticipantResponseDto {
    private Long id;
    private Long planId;
    private Long userId;
    private String userName;
    private String userEmail;
    private ParticipantRole role;
    private ParticipationStatus status;
    private LocalDateTime invitedAt;
    private LocalDateTime joinedAt;
}
