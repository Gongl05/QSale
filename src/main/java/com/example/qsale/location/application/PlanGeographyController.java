package com.example.qsale.location.application;

import com.example.qsale.location.domain.PlanGeographyService;
import com.example.qsale.location.dto.PlanGeographyDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/plans/{planId}/geography")
@RequiredArgsConstructor
public class PlanGeographyController {

    private final PlanGeographyService geographyService;

    @GetMapping
    public ResponseEntity<PlanGeographyDto> getGeography(@PathVariable Long planId) {
        return ResponseEntity.ok(geographyService.getGeography(planId));
    }
}
