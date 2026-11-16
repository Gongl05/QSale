package com.example.qsale.plan.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public record AgreementDto(LocalDate date, LocalTime time, String place) {}
