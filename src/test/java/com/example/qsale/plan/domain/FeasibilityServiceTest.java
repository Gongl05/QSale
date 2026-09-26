package com.example.qsale.plan.domain;

import com.example.qsale.availability.infrastructure.AvailabilityRepository;
import com.example.qsale.commitment.domain.CommitmentStatus;
import com.example.qsale.commitment.infrastructure.CommitmentResponseRepository;
import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.domain.PlanOption;
import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.user.domain.UserService;
import com.example.qsale.vote.infrastructure.VoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FeasibilityServiceTest {

    @Mock
    private PlanAccessService planAccessService;
    @Mock
    private UserService userService;
    @Mock
    private PlanParticipantRepository participantRepository;
    @Mock
    private CommitmentResponseRepository commitmentRepository;
    @Mock
    private AvailabilityRepository availabilityRepository;
    @Mock
    private PlanOptionRepository optionRepository;
    @Mock
    private VoteRepository voteRepository;

    private FeasibilityService feasibilityService;
    private Plan plan;

    @BeforeEach
    void setUp() {
        feasibilityService = new FeasibilityService(planAccessService, userService, participantRepository,
                commitmentRepository, availabilityRepository, optionRepository, voteRepository);
        plan = new Plan();
        plan.setId(1L);
        plan.setMinParticipants(2);
    }

    @Test
    void marksPlanReadyWhenConfirmationsAndAgreementReachThreshold() {
        stubParticipantAndAvailabilityCounts();
        PlanOption dateOption = new PlanOption();
        dateOption.setId(10L);
        when(commitmentRepository.countByPlanIdAndStatus(1L, CommitmentStatus.CONFIRMED)).thenReturn(2L);
        when(optionRepository.findByPlanIdAndType(1L, OptionType.DATE)).thenReturn(List.of(dateOption));
        when(optionRepository.findByPlanIdAndType(1L, OptionType.PLACE)).thenReturn(List.of());
        when(voteRepository.countByOptionId(10L)).thenReturn(2L);

        feasibilityService.updateFeasibility(plan);

        assertEquals(80, plan.getFeasibilityScore());
        assertEquals(FeasibilityStatus.READY_TO_CLOSE, plan.getFeasibilityStatus());
    }

    @Test
    void marksPlanToBeDefinedAtIntermediateScore() {
        stubParticipantAndAvailabilityCounts();
        PlanOption dateOption = new PlanOption();
        dateOption.setId(10L);
        when(commitmentRepository.countByPlanIdAndStatus(1L, CommitmentStatus.CONFIRMED)).thenReturn(1L);
        when(optionRepository.findByPlanIdAndType(1L, OptionType.DATE)).thenReturn(List.of(dateOption));
        when(optionRepository.findByPlanIdAndType(1L, OptionType.PLACE)).thenReturn(List.of());
        when(voteRepository.countByOptionId(10L)).thenReturn(1L);

        feasibilityService.updateFeasibility(plan);

        assertEquals(40, plan.getFeasibilityScore());
        assertEquals(FeasibilityStatus.TO_BE_DEFINED, plan.getFeasibilityStatus());
    }

    @Test
    void marksPlanNotViableWithoutSignals() {
        stubParticipantAndAvailabilityCounts();
        when(commitmentRepository.countByPlanIdAndStatus(1L, CommitmentStatus.CONFIRMED)).thenReturn(0L);
        when(optionRepository.findByPlanIdAndType(1L, OptionType.DATE)).thenReturn(List.of());
        when(optionRepository.findByPlanIdAndType(1L, OptionType.PLACE)).thenReturn(List.of());

        feasibilityService.updateFeasibility(plan);

        assertEquals(0, plan.getFeasibilityScore());
        assertEquals(FeasibilityStatus.NOT_VIABLE, plan.getFeasibilityStatus());
    }

    @Test
    void calculatesOptionScoreFromVotesAndDistance() {
        PlanOption option = new PlanOption();
        option.setAvgDistanceKm(10.0);

        assertEquals(50, feasibilityService.calculateOptionScore(option, 1, 2));
    }

    private void stubParticipantAndAvailabilityCounts() {
        when(participantRepository.countByPlanId(1L)).thenReturn(2L);
        when(availabilityRepository.findByPlanId(1L)).thenReturn(List.of());
    }
}
