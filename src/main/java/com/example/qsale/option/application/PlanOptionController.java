package com.example.qsale.option.application;

import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.domain.PlanOptionService;
import com.example.qsale.option.dto.OptionRequestDto;
import com.example.qsale.option.dto.OptionResponseDto;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/plans/{planId}/options")
@RequiredArgsConstructor
public class PlanOptionController {

    private final PlanOptionService planOptionService;

    @PostMapping
    public ResponseEntity<OptionResponseDto> createOption(@PathVariable Long planId,
                                                          @Valid @RequestBody OptionRequestDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(planOptionService.createOption(planId, dto));
    }

    @GetMapping
    public ResponseEntity<List<OptionResponseDto>> getOptions(@PathVariable Long planId,
                                                              @RequestParam(required = false) OptionType type) {
        return ResponseEntity.ok(planOptionService.getOptions(planId, type));
    }

    @DeleteMapping("/{optionId}")
    public ResponseEntity<Void> deleteOption(@PathVariable Long planId, @PathVariable Long optionId) {
        planOptionService.deleteOption(planId, optionId);
        return ResponseEntity.noContent().build();
    }
}
