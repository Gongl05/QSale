package com.example.qsale.plan.dto;

import com.example.qsale.plan.domain.PlanType;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
public class PlanRequestDto {

    @NotBlank
    @Size(min = 3, max = 100)
    private String name;

    @Size(max = 1000)
    private String description;

    @NotNull
    private PlanType type;

    @PositiveOrZero
    private Double budget;

    @NotNull
    @Min(2)
    @Max(100)
    private Integer minParticipants;

    @FutureOrPresent
    private LocalDate tentativeStartDate;

    @FutureOrPresent
    private LocalDate tentativeEndDate;
}
