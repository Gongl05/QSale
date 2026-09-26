package com.example.qsale.location.dto;

import java.util.List;

public record MatrixRequestDto(
        List<List<Double>> locations,
        List<Integer> sources,
        List<Integer> destinations,
        List<String> metrics,
        String units
) {
}
