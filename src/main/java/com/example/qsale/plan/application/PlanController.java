package com.example.qsale.plan.application;

import com.example.qsale.plan.domain.FeasibilityService;
import com.example.qsale.plan.domain.PlanService;
import com.example.qsale.plan.domain.PlanStatus;
import com.example.qsale.plan.dto.FeasibilityResponseDto;
import com.example.qsale.plan.dto.PlanDetailDto;
import com.example.qsale.plan.dto.PlanPageResponseDto;
import com.example.qsale.plan.dto.PlanRequestDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/plans")
@RequiredArgsConstructor
public class PlanController {

    private final PlanService planService;
    private final FeasibilityService feasibilityService;

    @PostMapping
    public ResponseEntity<PlanDetailDto> createPlan(@Valid @RequestBody PlanRequestDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(planService.createPlan(dto));
    }

    @GetMapping
    public ResponseEntity<PlanPageResponseDto> getMyPlans(@RequestParam(required = false) PlanStatus status,
                                                          @RequestParam(defaultValue = "0") int page,
                                                          @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(planService.getMyPlans(status, page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlanDetailDto> getPlan(@PathVariable Long id) {
        return ResponseEntity.ok(planService.getPlan(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PlanDetailDto> updatePlan(@PathVariable Long id, @Valid @RequestBody PlanRequestDto dto) {
        return ResponseEntity.ok(planService.updatePlan(id, dto));
    }

    @PatchMapping("/{id}/close")
    public ResponseEntity<PlanDetailDto> closePlan(@PathVariable Long id) {
        return ResponseEntity.ok(planService.closePlan(id));
    }

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<PlanDetailDto> cancelPlan(@PathVariable Long id) {
        return ResponseEntity.ok(planService.cancelPlan(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePlan(@PathVariable Long id) {
        planService.deletePlan(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/feasibility")
    public ResponseEntity<FeasibilityResponseDto> getFeasibility(@PathVariable Long id) {
        return ResponseEntity.ok(feasibilityService.getFeasibility(id));
    }
}
