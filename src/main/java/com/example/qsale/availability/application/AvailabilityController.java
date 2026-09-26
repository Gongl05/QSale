package com.example.qsale.availability.application;

import com.example.qsale.availability.domain.AvailabilityService;
import com.example.qsale.availability.dto.AvailabilityRequestDto;
import com.example.qsale.availability.dto.AvailabilityResponseDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/plans/{planId}/availabilities")
@RequiredArgsConstructor
public class AvailabilityController {

    private final AvailabilityService availabilityService;

    @PostMapping
    public ResponseEntity<AvailabilityResponseDto> addAvailability(@PathVariable Long planId,
                                                                   @Valid @RequestBody AvailabilityRequestDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(availabilityService.addAvailability(planId, dto));
    }

    @GetMapping
    public ResponseEntity<List<AvailabilityResponseDto>> getAvailabilities(@PathVariable Long planId) {
        return ResponseEntity.ok(availabilityService.getAvailabilities(planId));
    }

    @DeleteMapping("/{availabilityId}")
    public ResponseEntity<Void> deleteAvailability(@PathVariable Long planId, @PathVariable Long availabilityId) {
        availabilityService.deleteAvailability(planId, availabilityId);
        return ResponseEntity.noContent().build();
    }
}
