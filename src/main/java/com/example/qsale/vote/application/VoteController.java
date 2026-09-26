package com.example.qsale.vote.application;

import com.example.qsale.vote.domain.VoteService;
import com.example.qsale.vote.dto.VoteResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/options/{optionId}/votes")
@RequiredArgsConstructor
public class VoteController {

    private final VoteService voteService;

    @PostMapping
    public ResponseEntity<VoteResponseDto> vote(@PathVariable Long optionId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(voteService.vote(optionId));
    }

    @DeleteMapping
    public ResponseEntity<Void> removeVote(@PathVariable Long optionId) {
        voteService.removeVote(optionId);
        return ResponseEntity.noContent().build();
    }
}
