package com.example.qsale.availability.domain;

import com.example.qsale.availability.dto.AvailabilityRequestDto;
import com.example.qsale.availability.dto.AvailabilityResponseDto;
import com.example.qsale.availability.infrastructure.AvailabilityRepository;
import com.example.qsale.exceptions.ForbiddenException;
import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.exceptions.ResourceNotFoundException;
import com.example.qsale.participant.domain.ParticipantService;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.plan.domain.PlanAccessService;
import com.example.qsale.plan.events.PlanChangedEvent;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AvailabilityService {

    private final AvailabilityRepository availabilityRepository;
    private final PlanAccessService planAccessService;
    private final ParticipantService participantService;
    private final UserService userService;
    private final ApplicationEventPublisher eventPublisher;
    private final ModelMapper modelMapper;

    @Transactional
    public AvailabilityResponseDto addAvailability(Long planId, AvailabilityRequestDto dto) {
        validateTimes(dto);
        User user = userService.getCurrentUser();
        Plan plan = planAccessService.getPlanAsMember(planId, user);
        planAccessService.requireOpen(plan);
        participantService.requireJoined(planId, user);

        Availability availability = new Availability(plan, user, dto.getAvailableDate(),
                dto.getStartTime(), dto.getEndTime());
        availabilityRepository.save(availability);
        eventPublisher.publishEvent(new PlanChangedEvent(this, plan.getId()));
        return modelMapper.map(availability, AvailabilityResponseDto.class);
    }

    public List<AvailabilityResponseDto> getAvailabilities(Long planId) {
        planAccessService.getPlanAsMember(planId, userService.getCurrentUser());
        return availabilityRepository.findByPlanId(planId).stream()
                .map(availability -> modelMapper.map(availability, AvailabilityResponseDto.class))
                .toList();
    }

    @Transactional
    public void deleteAvailability(Long planId, Long availabilityId) {
        User user = userService.getCurrentUser();
        Plan plan = planAccessService.getPlanAsMember(planId, user);
        planAccessService.requireOpen(plan);
        Availability availability = availabilityRepository.findById(availabilityId)
                .filter(found -> found.getPlan().getId().equals(planId))
                .orElseThrow(() -> new ResourceNotFoundException("Availability " + availabilityId + " not found in plan " + planId));
        if (!availability.getUser().getId().equals(user.getId())) {
            throw new ForbiddenException("You can only delete your own availability");
        }
        plan.getAvailabilities().remove(availability);
        eventPublisher.publishEvent(new PlanChangedEvent(this, plan.getId()));
    }

    private void validateTimes(AvailabilityRequestDto dto) {
        if (dto.getStartTime() != null && dto.getEndTime() != null && !dto.getEndTime().isAfter(dto.getStartTime())) {
            throw new InvalidOperationException("endTime must be after startTime");
        }
    }
}
