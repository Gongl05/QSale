package com.example.qsale.commitment.dto;

import com.example.qsale.commitment.domain.CommitmentStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class CommitmentResponseDto {
    private Long id;
    private Long userId;
    private String userName;
    private CommitmentStatus status;
    private String note;
    private LocalDateTime respondedAt;
}
