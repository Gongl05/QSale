package com.example.qsale.option.domain;

import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.exceptions.ResourceNotFoundException;
import com.example.qsale.location.domain.GeoService;
import com.example.qsale.location.domain.Location;
import com.example.qsale.location.dto.TravelEstimateDto;
import com.example.qsale.option.dto.OptionRequestDto;
import com.example.qsale.option.dto.OptionResponseDto;
import com.example.qsale.option.events.PlaceOptionCreatedEvent;
import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.participant.domain.ParticipationStatus;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.domain.FeasibilityService;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.plan.domain.PlanAccessService;
import com.example.qsale.plan.events.PlanChangedEvent;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import com.example.qsale.vote.infrastructure.VoteRepository;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class PlanOptionService {

    private final PlanOptionRepository optionRepository;
    private final PlanParticipantRepository participantRepository;
    private final VoteRepository voteRepository;
    private final PlanAccessService planAccessService;
    private final FeasibilityService feasibilityService;
    private final UserService userService;
    private final GeoService geoService;
    private final ModelMapper modelMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public OptionResponseDto createOption(Long planId, OptionRequestDto dto) {
        User user = userService.getCurrentUser();
        Plan plan = planAccessService.getPlanAsMember(planId, user);
        planAccessService.requireOpen(plan);
        validateOption(dto);

        PlanOption option = modelMapper.map(dto, PlanOption.class);
        option.setProposedBy(user);
        plan.addOption(option);
        optionRepository.save(option);
        if (option.getType() == OptionType.PLACE) {
            eventPublisher.publishEvent(new PlaceOptionCreatedEvent(this, option.getId()));
        }
        return toResponse(option, participantRepository.countByPlanId(planId));
    }

    @Transactional
    public void updateTravelEstimate(Long optionId) {
        optionRepository.findById(optionId)
                .filter(option -> option.getType() == OptionType.PLACE)
                .ifPresent(option -> updateTravelEstimate(option, getOrigins(option.getPlan().getId())));
    }

    @Transactional
    public void updatePlanTravelEstimates(Long planId) {
        List<PlanOption> options = optionRepository.findByPlanIdAndType(planId, OptionType.PLACE);
        if (options.isEmpty()) {
            return;
        }
        List<Location> origins = getOrigins(planId);
        options.forEach(option -> updateTravelEstimate(option, origins));
    }

    private List<Location> getOrigins(Long planId) {
        return participantRepository.findByPlanId(planId).stream()
                .filter(participant -> participant.getStatus() == ParticipationStatus.JOINED)
                .map(participant -> participant.getUser().getLocation())
                .filter(Objects::nonNull)
                .toList();
    }

    private void updateTravelEstimate(PlanOption option, List<Location> origins) {
        if (origins.isEmpty() || option.getLocation() == null) {
            option.setAvgDistanceKm(null);
            option.setAvgTravelMinutes(null);
            return;
        }
        TravelEstimateDto estimate = geoService.estimateAverageTravel(origins, option.getLocation());
        option.setAvgDistanceKm(estimate.avgDistanceKm());
        option.setAvgTravelMinutes(estimate.avgTravelMinutes());
    }

    public List<OptionResponseDto> getOptions(Long planId, OptionType type) {
        planAccessService.getPlanAsMember(planId, userService.getCurrentUser());
        List<PlanOption> options = type == null
                ? optionRepository.findByPlanId(planId)
                : optionRepository.findByPlanIdAndType(planId, type);
        long participants = participantRepository.countByPlanId(planId);
        return options.stream()
                .map(option -> toResponse(option, participants))
                .sorted(Comparator.comparingInt(OptionResponseDto::getScore).reversed())
                .toList();
    }

    @Transactional
    public void deleteOption(Long planId, Long optionId) {
        Plan plan = planAccessService.getPlanAsOrganizer(planId, userService.getCurrentUser());
        planAccessService.requireOpen(plan);
        PlanOption option = optionRepository.findByIdAndPlanId(optionId, planId)
                .orElseThrow(() -> new ResourceNotFoundException("Option " + optionId + " not found in plan " + planId));
        plan.getOptions().remove(option);
        eventPublisher.publishEvent(new PlanChangedEvent(this, planId));
    }

    public PlanOption getOption(Long optionId) {
        return optionRepository.findById(optionId)
                .orElseThrow(() -> new ResourceNotFoundException("Option not found with id " + optionId));
    }

    @Transactional
    public void selectBestOptions(Plan plan) {
        for (OptionType type : OptionType.values()) {
            optionRepository.findByPlanIdAndType(plan.getId(), type).stream()
                    .filter(option -> voteRepository.countByOptionId(option.getId()) > 0)
                    .max(Comparator.comparingLong(option -> voteRepository.countByOptionId(option.getId())))
                    .ifPresent(option -> option.setSelected(true));
        }
    }

    private void validateOption(OptionRequestDto dto) {
        if (dto.getType() == OptionType.DATE && dto.getStartsAt() == null) {
            throw new InvalidOperationException("A DATE option requires startsAt");
        }
        if (dto.getType() == OptionType.PLACE && dto.getLocation() == null) {
            throw new InvalidOperationException("A PLACE option requires a location");
        }
        if (dto.getStartsAt() != null && dto.getEndsAt() != null && dto.getEndsAt().isBefore(dto.getStartsAt())) {
            throw new InvalidOperationException("endsAt must be after startsAt");
        }
    }

    private OptionResponseDto toResponse(PlanOption option, long participants) {
        OptionResponseDto response = modelMapper.map(option, OptionResponseDto.class);
        long votes = voteRepository.countByOptionId(option.getId());
        response.setVoteCount(votes);
        response.setScore(feasibilityService.calculateOptionScore(option, votes, participants));
        return response;
    }
}
