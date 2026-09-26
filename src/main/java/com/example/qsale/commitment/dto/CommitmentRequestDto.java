package com.example.qsale.commitment.dto;

import com.example.qsale.commitment.domain.CommitmentStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CommitmentRequestDto {

    @NotNull
    private CommitmentStatus status;

    @Size(max = 255)
    private String note;
}
