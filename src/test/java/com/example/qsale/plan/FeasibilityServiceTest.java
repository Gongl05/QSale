package com.example.qsale.plan;

import com.example.qsale.availability.domain.Availability;
import com.example.qsale.availability.infrastructure.AvailabilityRepository;
import com.example.qsale.commitment.domain.CommitmentStatus;
import com.example.qsale.commitment.infrastructure.CommitmentResponseRepository;
import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.domain.PlanOption;
import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.domain.FeasibilityService;
import com.example.qsale.plan.domain.FeasibilityStatus;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.user.domain.Role;
import com.example.qsale.user.domain.User;
import com.example.qsale.vote.infrastructure.VoteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FeasibilityServiceTest {

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

    @InjectMocks
    private FeasibilityService feasibilityService;

    @Test
    void planShouldBeReadyWhenEveryoneConfirmedAgreedAndIsAvailable() {
        Plan plan = buildPlan(1L, 2);
        PlanOption date = buildOption(10L, null);
        when(commitmentRepository.countByPlanIdAndStatus(1L, CommitmentStatus.CONFIRMED)).thenReturn(2L);
        when(participantRepository.countByPlanId(1L)).thenReturn(2L);
        when(optionRepository.findByPlanIdAndType(1L, OptionType.DATE)).thenReturn(List.of(date));
        when(optionRepository.findByPlanIdAndType(1L, OptionType.PLACE)).thenReturn(List.of());
        when(voteRepository.countByOptionId(10L)).thenReturn(2L);
        when(availabilityRepository.findByPlanId(1L)).thenReturn(List.of(
                buildAvailability(plan, 100L), buildAvailability(plan, 200L)));

        feasibilityService.updateFeasibility(plan);

        assertEquals(100, plan.getFeasibilityScore());
        assertEquals(FeasibilityStatus.READY_TO_CLOSE, plan.getFeasibilityStatus());
    }

    @Test
    void planShouldBeToBeDefinedWhenMinimumIsNotConfirmedYet() {
        Plan plan = buildPlan(1L, 2);
        PlanOption date = buildOption(10L, null);
        when(commitmentRepository.countByPlanIdAndStatus(1L, CommitmentStatus.CONFIRMED)).thenReturn(1L);
        when(participantRepository.countByPlanId(1L)).thenReturn(2L);
        when(optionRepository.findByPlanIdAndType(1L, OptionType.DATE)).thenReturn(List.of(date));
        when(optionRepository.findByPlanIdAndType(1L, OptionType.PLACE)).thenReturn(List.of());
        when(voteRepository.countByOptionId(10L)).thenReturn(2L);
        when(availabilityRepository.findByPlanId(1L)).thenReturn(List.of(
                buildAvailability(plan, 100L), buildAvailability(plan, 200L)));

        feasibilityService.updateFeasibility(plan);

        assertEquals(75, plan.getFeasibilityScore());
        assertEquals(FeasibilityStatus.TO_BE_DEFINED, plan.getFeasibilityStatus());
    }

    @Test
    void planShouldNotBeViableWithoutActivity() {
        Plan plan = buildPlan(1L, 3);

        feasibilityService.updateFeasibility(plan);

        assertEquals(0, plan.getFeasibilityScore());
        assertEquals(FeasibilityStatus.NOT_VIABLE, plan.getFeasibilityStatus());
    }

    @Test
    void optionScoreShouldCombineVotesAndProximity() {
        PlanOption nearbyPlace = buildOption(10L, 5.0);

        int score = feasibilityService.calculateOptionScore(nearbyPlace, 3, 4);

        assertEquals(75, score);
    }

    @Test
    void optionScoreShouldBeZeroWithoutVotesOrDistance() {
        PlanOption option = buildOption(10L, null);

        int score = feasibilityService.calculateOptionScore(option, 0, 4);

        assertEquals(0, score);
    }

    private Plan buildPlan(Long id, int minParticipants) {
        Plan plan = new Plan();
        plan.setId(id);
        plan.setMinParticipants(minParticipants);
        return plan;
    }

    private PlanOption buildOption(Long id, Double avgDistanceKm) {
        PlanOption option = new PlanOption();
        option.setId(id);
        option.setAvgDistanceKm(avgDistanceKm);
        return option;
    }

    private Availability buildAvailability(Plan plan, Long userId) {
        User user = new User("User " + userId, userId + "@utec.edu.pe", "hashed", Role.USER);
        user.setId(userId);
        return new Availability(plan, user, LocalDate.now().plusDays(3), null, null);
    }
}
