package com.example.qsale.availability.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Setter
@NoArgsConstructor
public class AvailabilityResponseDto {
    private Long id;
    private Long userId;
    private String userName;
    private LocalDate availableDate;
    private LocalTime startTime;
    private LocalTime endTime;
}
