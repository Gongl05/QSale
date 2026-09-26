package com.example.qsale.plan.domain;

import com.example.qsale.exceptions.ForbiddenException;
import com.example.qsale.exceptions.ParticipantNotInPlanException;
import com.example.qsale.exceptions.PlanClosedException;
import com.example.qsale.participant.domain.ParticipantRole;
import com.example.qsale.participant.domain.PlanParticipant;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.infrastructure.PlanRepository;
import com.example.qsale.user.domain.Role;
import com.example.qsale.user.domain.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlanAccessServiceTest {

    @Mock
    private PlanRepository planRepository;
    @Mock
    private PlanParticipantRepository participantRepository;

    private PlanAccessService planAccessService;
    private Plan plan;
    private User user;

    @BeforeEach
    void setUp() {
        planAccessService = new PlanAccessService(planRepository, participantRepository);
        plan = new Plan();
        plan.setId(1L);
        plan.setStatus(PlanStatus.OPEN);
        user = new User();
        user.setId(2L);
        user.setRole(Role.USER);
    }

    @Test
    void rejectsUserWhoIsNotAPlanMember() {
        stubPlanLookup();
        when(participantRepository.existsByPlanIdAndUserId(1L, 2L)).thenReturn(false);

        assertThrows(ParticipantNotInPlanException.class,
                () -> planAccessService.getPlanAsMember(1L, user));
    }

    @Test
    void allowsAdminToModerateAnyPlan() {
        stubPlanLookup();
        user.setRole(Role.ADMIN);

        assertSame(plan, planAccessService.getPlanAsOrganizer(1L, user));
    }

    @Test
    void rejectsMemberWhoIsNotOrganizer() {
        stubPlanLookup();
        PlanParticipant participant = new PlanParticipant(plan, user, ParticipantRole.GUEST);
        when(participantRepository.findByPlanIdAndUserId(1L, 2L)).thenReturn(Optional.of(participant));

        assertThrows(ForbiddenException.class,
                () -> planAccessService.getPlanAsOrganizer(1L, user));
    }

    @Test
    void rejectsChangesToClosedPlan() {
        plan.setStatus(PlanStatus.CLOSED);

        assertThrows(PlanClosedException.class, () -> planAccessService.requireOpen(plan));
    }

    private void stubPlanLookup() {
        when(planRepository.findById(1L)).thenReturn(Optional.of(plan));
    }
}
