package com.example.qsale.availability.dto;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Setter
@NoArgsConstructor
public class AvailabilityRequestDto {

    @NotNull
    @FutureOrPresent
    private LocalDate availableDate;

    private LocalTime startTime;

    private LocalTime endTime;
}
