package com.example.qsale.vote.domain;

import com.example.qsale.exceptions.AlreadyVotedException;
import com.example.qsale.exceptions.ResourceNotFoundException;
import com.example.qsale.option.domain.PlanOption;
import com.example.qsale.option.domain.PlanOptionService;
import com.example.qsale.participant.domain.ParticipantService;
import com.example.qsale.plan.domain.FeasibilityService;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.plan.domain.PlanAccessService;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import com.example.qsale.vote.dto.VoteResponseDto;
import com.example.qsale.vote.infrastructure.VoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VoteService {

    private final VoteRepository voteRepository;
    private final PlanOptionService planOptionService;
    private final ParticipantService participantService;
    private final PlanAccessService planAccessService;
    private final FeasibilityService feasibilityService;
    private final UserService userService;

    @Transactional
    public VoteResponseDto vote(Long optionId) {
        User user = userService.getCurrentUser();
        PlanOption option = planOptionService.getOption(optionId);
        Plan plan = getOpenPlanForVoter(option, user);
        if (voteRepository.existsByOptionIdAndUserId(optionId, user.getId())) {
            throw new AlreadyVotedException("You have already voted for option " + optionId);
        }
        voteRepository.save(new Vote(option, user));
        feasibilityService.updateFeasibility(plan);
        return new VoteResponseDto(optionId, voteRepository.countByOptionId(optionId));
    }

    @Transactional
    public void removeVote(Long optionId) {
        User user = userService.getCurrentUser();
        PlanOption option = planOptionService.getOption(optionId);
        Plan plan = getOpenPlanForVoter(option, user);
        Vote vote = voteRepository.findByOptionIdAndUserId(optionId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("You have not voted for option " + optionId));
        option.getVotes().remove(vote);
        feasibilityService.updateFeasibility(plan);
    }

    private Plan getOpenPlanForVoter(PlanOption option, User user) {
        Plan plan = planAccessService.getPlanAsMember(option.getPlan().getId(), user);
        planAccessService.requireOpen(plan);
        participantService.requireJoined(plan.getId(), user);
        return plan;
    }
}
