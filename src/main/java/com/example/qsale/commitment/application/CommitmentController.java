package com.example.qsale.commitment.application;

import com.example.qsale.commitment.domain.CommitmentService;
import com.example.qsale.commitment.dto.CommitmentRequestDto;
import com.example.qsale.commitment.dto.CommitmentResponseDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/plans/{planId}/commitments")
@RequiredArgsConstructor
public class CommitmentController {

    private final CommitmentService commitmentService;

    @PutMapping("/me")
    public ResponseEntity<CommitmentResponseDto> respond(@PathVariable Long planId,
                                                         @Valid @RequestBody CommitmentRequestDto dto) {
        return ResponseEntity.ok(commitmentService.respond(planId, dto));
    }

    @GetMapping
    public ResponseEntity<List<CommitmentResponseDto>> getCommitments(@PathVariable Long planId) {
        return ResponseEntity.ok(commitmentService.getCommitments(planId));
    }
}
