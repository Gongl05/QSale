package com.example.qsale.plan.domain;

import com.example.qsale.availability.infrastructure.AvailabilityRepository;
import com.example.qsale.commitment.domain.CommitmentStatus;
import com.example.qsale.commitment.infrastructure.CommitmentResponseRepository;
import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.domain.PlanOption;
import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.dto.FeasibilityResponseDto;
import com.example.qsale.user.domain.UserService;
import com.example.qsale.vote.infrastructure.VoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FeasibilityService {

    private static final int READY_THRESHOLD = 75;
    private static final int TO_BE_DEFINED_THRESHOLD = 40;

    private final PlanAccessService planAccessService;
    private final UserService userService;
    private final PlanParticipantRepository participantRepository;
    private final CommitmentResponseRepository commitmentRepository;
    private final AvailabilityRepository availabilityRepository;
    private final PlanOptionRepository optionRepository;
    private final VoteRepository voteRepository;

    public FeasibilityResponseDto getFeasibility(Long planId) {
        Plan plan = planAccessService.getPlanAsMember(planId, userService.getCurrentUser());
        long confirmed = countConfirmed(planId);
        int score = calculateScore(plan, confirmed);
        return new FeasibilityResponseDto(plan.getId(), score, resolveStatus(score, confirmed, plan.getMinParticipants()),
                confirmed, plan.getMinParticipants(), participantRepository.countByPlanId(planId));
    }

    @Transactional
    public boolean recalculate(Long planId) {
        Plan plan = planAccessService.getPlan(planId);
        if (!plan.isOpen()) {
            return false;
        }
        FeasibilityStatus previous = plan.getFeasibilityStatus();
        updateFeasibility(plan);
        return previous != FeasibilityStatus.READY_TO_CLOSE
                && plan.getFeasibilityStatus() == FeasibilityStatus.READY_TO_CLOSE;
    }

    @Transactional
    public void updateFeasibility(Plan plan) {
        long confirmed = countConfirmed(plan.getId());
        int score = calculateScore(plan, confirmed);
        plan.setFeasibilityScore(score);
        plan.setFeasibilityStatus(resolveStatus(score, confirmed, plan.getMinParticipants()));
    }

    public int calculateOptionScore(PlanOption option, long votes, long participants) {
        double voteRatio = participants == 0 ? 0 : Math.min((double) votes / participants, 1.0);
        double proximity = option.getAvgDistanceKm() == null ? 0 : Math.max(0, 1 - option.getAvgDistanceKm() / 20);
        return (int) Math.round(voteRatio * 80 + proximity * 20);
    }

    private int calculateScore(Plan plan, long confirmed) {
        long participants = Math.max(participantRepository.countByPlanId(plan.getId()), 1);
        double confirmationRatio = Math.min((double) confirmed / plan.getMinParticipants(), 1.0);
        double agreementRatio = calculateAgreement(plan.getId(), participants);
        double availabilityRatio = Math.min((double) countUsersWithAvailability(plan.getId()) / participants, 1.0);
        return (int) Math.round(confirmationRatio * 50 + agreementRatio * 30 + availabilityRatio * 20);
    }

    private double calculateAgreement(Long planId, long participants) {
        return Arrays.stream(OptionType.values())
                .map(type -> optionRepository.findByPlanIdAndType(planId, type))
                .filter(options -> !options.isEmpty())
                .mapToDouble(options -> Math.min((double) maxVotes(options) / participants, 1.0))
                .average()
                .orElse(0);
    }

    private long maxVotes(List<PlanOption> options) {
        return options.stream()
                .mapToLong(option -> voteRepository.countByOptionId(option.getId()))
                .max()
                .orElse(0);
    }

    private long countUsersWithAvailability(Long planId) {
        return availabilityRepository.findByPlanId(planId).stream()
                .map(availability -> availability.getUser().getId())
                .distinct()
                .count();
    }

    private long countConfirmed(Long planId) {
        return commitmentRepository.countByPlanIdAndStatus(planId, CommitmentStatus.CONFIRMED);
    }

    private FeasibilityStatus resolveStatus(int score, long confirmed, int minParticipants) {
        if (confirmed >= minParticipants && score >= READY_THRESHOLD) {
            return FeasibilityStatus.READY_TO_CLOSE;
        }
        if (score >= TO_BE_DEFINED_THRESHOLD) {
            return FeasibilityStatus.TO_BE_DEFINED;
        }
        return FeasibilityStatus.NOT_VIABLE;
    }
}
