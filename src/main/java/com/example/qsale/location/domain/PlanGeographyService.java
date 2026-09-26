package com.example.qsale.location.domain;

import com.example.qsale.location.dto.MidpointDto;
import com.example.qsale.location.dto.PlanGeographyDto;
import com.example.qsale.participant.domain.ParticipationStatus;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.domain.PlanAccessService;
import com.example.qsale.user.domain.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class PlanGeographyService {

    private final PlanAccessService planAccessService;
    private final PlanParticipantRepository participantRepository;
    private final UserService userService;
    private final GeoService geoService;

    @Transactional(readOnly = true)
    public PlanGeographyDto getGeography(Long planId) {
        planAccessService.getPlanAsMember(planId, userService.getCurrentUser());
        List<Location> origins = participantRepository.findByPlanId(planId).stream()
                .filter(participant -> participant.getStatus() == ParticipationStatus.JOINED)
                .map(participant -> participant.getUser().getLocation())
                .filter(Objects::nonNull)
                .toList();
        long joined = participantRepository.countByPlanIdAndStatus(planId, ParticipationStatus.JOINED);
        MidpointDto midpoint = origins.size() >= 2 ? geoService.geographicMidpoint(origins) : null;
        return new PlanGeographyDto(midpoint, origins.size(), joined);
    }
}
