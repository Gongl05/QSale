package com.example.qsale.location;

import com.example.qsale.exceptions.ParticipantNotInPlanException;
import com.example.qsale.location.domain.GeoService;
import com.example.qsale.location.domain.Location;
import com.example.qsale.location.domain.PlanGeographyService;
import com.example.qsale.participant.domain.ParticipantRole;
import com.example.qsale.participant.domain.ParticipationStatus;
import com.example.qsale.participant.domain.PlanParticipant;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.plan.domain.PlanAccessService;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlanGeographyServiceTest {

    @Mock private PlanAccessService accessService;
    @Mock private PlanParticipantRepository participantRepository;
    @Mock private UserService userService;
    @Mock private GeoService geoService;
    @InjectMocks private PlanGeographyService geographyService;

    @Test
    void includesOnlyJoinedParticipantsWithLocations() {
        User current = user(1L, new Location(-12.12, -77.03, null));
        User second = user(2L, new Location(-12.15, -77.02, null));
        User invited = user(3L, new Location(-12.16, -77.01, null));
        Plan plan = new Plan();
        when(userService.getCurrentUser()).thenReturn(current);
        when(participantRepository.findByPlanId(7L)).thenReturn(List.of(
                participant(plan, current, ParticipationStatus.JOINED),
                participant(plan, second, ParticipationStatus.JOINED),
                participant(plan, invited, ParticipationStatus.INVITED)));
        when(participantRepository.countByPlanIdAndStatus(7L, ParticipationStatus.JOINED)).thenReturn(2L);
        when(geoService.geographicMidpoint(anyList())).thenReturn(new com.example.qsale.location.dto.MidpointDto(-12.14, -77.02));

        var result = geographyService.getGeography(7L);

        assertEquals(2, result.locatedParticipants());
        assertEquals(2, result.joinedParticipants());
        assertNotNull(result.midpoint());
        verify(accessService).getPlanAsMember(7L, current);
    }

    @Test
    void omitsMidpointWhenOnlyOneLocationIsAvailable() {
        User current = user(1L, new Location(-12.12, -77.03, null));
        when(userService.getCurrentUser()).thenReturn(current);
        when(participantRepository.findByPlanId(7L)).thenReturn(List.of(
                participant(new Plan(), current, ParticipationStatus.JOINED)));
        when(participantRepository.countByPlanIdAndStatus(7L, ParticipationStatus.JOINED)).thenReturn(1L);

        assertNull(geographyService.getGeography(7L).midpoint());
    }

    @Test
    void refusesNonMembersBeforeReadingLocations() {
        User current = user(1L, null);
        when(userService.getCurrentUser()).thenReturn(current);
        when(accessService.getPlanAsMember(7L, current)).thenThrow(new ParticipantNotInPlanException("Not in plan"));

        assertThrows(ParticipantNotInPlanException.class, () -> geographyService.getGeography(7L));
    }

    private User user(Long id, Location location) {
        User user = new User();
        user.setId(id);
        user.setLocation(location);
        return user;
    }

    private PlanParticipant participant(Plan plan, User user, ParticipationStatus status) {
        PlanParticipant participant = new PlanParticipant(plan, user, ParticipantRole.GUEST);
        participant.setStatus(status);
        return participant;
    }
}
