package com.example.qsale.participant.application;

import com.example.qsale.participant.domain.ParticipantService;
import com.example.qsale.participant.dto.ParticipantInviteDto;
import com.example.qsale.participant.dto.ParticipantResponseDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/plans")
@RequiredArgsConstructor
public class ParticipantController {

    private final ParticipantService participantService;

    @PostMapping("/{planId}/participants")
    public ResponseEntity<ParticipantResponseDto> inviteParticipant(@PathVariable Long planId,
                                                                    @Valid @RequestBody ParticipantInviteDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(participantService.inviteParticipant(planId, dto));
    }

    @GetMapping("/{planId}/participants")
    public ResponseEntity<List<ParticipantResponseDto>> getParticipants(@PathVariable Long planId) {
        return ResponseEntity.ok(participantService.getParticipants(planId));
    }

    @PatchMapping("/{planId}/participants/me")
    public ResponseEntity<ParticipantResponseDto> acceptInvitation(@PathVariable Long planId) {
        return ResponseEntity.ok(participantService.acceptInvitation(planId));
    }

    @DeleteMapping("/{planId}/participants/{userId}")
    public ResponseEntity<Void> removeParticipant(@PathVariable Long planId, @PathVariable Long userId) {
        participantService.removeParticipant(planId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/join/{inviteCode}")
    public ResponseEntity<ParticipantResponseDto> joinByInviteCode(@PathVariable String inviteCode) {
        return ResponseEntity.status(HttpStatus.CREATED).body(participantService.joinByInviteCode(inviteCode));
    }
}
