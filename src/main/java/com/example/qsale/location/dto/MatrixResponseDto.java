package com.example.qsale.location.dto;

import java.util.List;

public record MatrixResponseDto(List<List<Double>> distances, List<List<Double>> durations) {
}
