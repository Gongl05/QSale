package com.example.qsale.option.domain;

import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.exceptions.ResourceNotFoundException;
import com.example.qsale.location.domain.GeoService;
import com.example.qsale.location.domain.Location;
import com.example.qsale.location.domain.TravelEstimateStatus;
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
import com.example.qsale.plan.dto.AgreementDto;
import com.example.qsale.plan.events.PlanChangedEvent;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import com.example.qsale.vote.infrastructure.VoteRepository;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.Map;
import java.util.stream.Collectors;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;

@Service
@RequiredArgsConstructor
public class PlanOptionService {

    @Value("${plans.time-zone:America/Lima}")
    private String timeZone = "America/Lima";

    private final PlanOptionRepository optionRepository;
    private final PlanParticipantRepository participantRepository;
    private final VoteRepository voteRepository;
    private final PlanAccessService planAccessService;
    private final FeasibilityService feasibilityService;
    private final UserService userService;
    private final GeoService geoService;
    private final ModelMapper modelMapper;
    private final ApplicationEventPublisher eventPublisher;

    @PreAuthorize("@planAuthorization.isJoined(#planId, authentication)")
    @Transactional
    public OptionResponseDto createOption(Long planId, OptionRequestDto dto) {
        User user = userService.getCurrentUser();
        Plan plan = planAccessService.lockAsMember(planId, user);
        planAccessService.requireOpen(plan);
        planAccessService.requireJoined(planId, user);
        validateOption(dto);

        PlanOption option = modelMapper.map(dto, PlanOption.class);
        if (option.getType() == OptionType.DATE) {
            option.setStartsOn(dto.getStartsOn() != null ? dto.getStartsOn() : dto.getStartsAt().toLocalDate());
            option.setEndsOn(dto.getEndsOn() != null ? dto.getEndsOn() : dto.getEndsAt() == null ? null : dto.getEndsAt().toLocalDate());
        }
        if (option.getType() == OptionType.PLACE) {
            option.setEstimateStatus(TravelEstimateStatus.PENDING);
        }
        option.setProposedBy(user);
        plan.addOption(option);
        optionRepository.save(option);
        eventPublisher.publishEvent(new PlanChangedEvent(this, planId));
        if (option.getType() == OptionType.PLACE) {
            eventPublisher.publishEvent(new PlaceOptionCreatedEvent(this, option.getId()));
        }
        return toResponse(option, participantRepository.countByPlanIdAndStatus(planId, ParticipationStatus.JOINED));
    }

    @Transactional
    public void updateTravelEstimate(Long optionId) {
        optionRepository.findById(optionId)
                .filter(option -> option.getType() == OptionType.PLACE)
                .ifPresent(option -> updateTravelEstimate(option, getOrigins(option.getPlan().getId())));
    }

    @Transactional
    public void markTravelEstimatesPending(Long planId) {
        optionRepository.findByPlanIdAndType(planId, OptionType.PLACE).forEach(option -> {
            option.setEstimateStatus(TravelEstimateStatus.PENDING);
            option.setAvgDistanceKm(null);
            option.setAvgTravelMinutes(null);
            option.setEstimateSource(null);
        });
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
            option.setEstimateSource(null);
            option.setEstimateStatus(TravelEstimateStatus.UNAVAILABLE);
            option.setEstimateUpdatedAt(Instant.now());
            return;
        }
        TravelEstimateDto estimate = geoService.estimateAverageTravel(origins, option.getLocation());
        option.setAvgDistanceKm(estimate.avgDistanceKm());
        option.setAvgTravelMinutes(estimate.avgTravelMinutes());
        option.setEstimateSource(estimate.source());
        option.setEstimateStatus(TravelEstimateStatus.READY);
        option.setEstimateUpdatedAt(Instant.now());
    }

    @PreAuthorize("@planAuthorization.isMember(#planId, authentication)")
    @Transactional(readOnly = true)
    public List<OptionResponseDto> getOptions(Long planId, OptionType type) {
        User user = userService.getCurrentUser();
        planAccessService.getPlanAsMember(planId, user);
        List<PlanOption> options = type == null
                ? optionRepository.findByPlanId(planId)
                : optionRepository.findByPlanIdAndType(planId, type);
        long participants = participantRepository.countByPlanIdAndStatus(planId, ParticipationStatus.JOINED);
        Set<Long> votedOptions = options.isEmpty() ? Set.of()
                : Set.copyOf(voteRepository.findVotedOptionIds(user.getId(), options.stream().map(PlanOption::getId).toList()));
        return options.stream()
                .map(option -> {
                    OptionResponseDto response = toResponse(option, participants);
                    response.setHasVoted(votedOptions.contains(option.getId()));
                    return response;
                })
                .sorted(Comparator.comparingLong(OptionResponseDto::getVoteCount).reversed()
                        .thenComparing(Comparator.comparingInt(OptionResponseDto::getScore).reversed())
                        .thenComparing(OptionResponseDto::getId))
                .toList();
    }

    @PreAuthorize("@planAuthorization.isOrganizer(#planId, authentication)")
    @Transactional
    public void deleteOption(Long planId, Long optionId) {
        Plan plan = planAccessService.lockAsOrganizer(planId, userService.getCurrentUser());
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
        PlanOption date = bestVotedOption(plan.getId(), OptionType.DATE);
        PlanOption place = bestVotedOption(plan.getId(), OptionType.PLACE);
        optionRepository.findByPlanId(plan.getId()).forEach(option -> option.setSelected(false));
        date.setSelected(true);
        place.setSelected(true);
        plan.setTentativeStartDate(date.getEffectiveDate());
        plan.setTentativeEndDate(date.getEffectiveEndDate());
    }

    @Transactional(readOnly = true)
    public AgreementDto closingPreview(Plan plan) {
        if (!plan.isOpen()) return null;
        try {
            return agreement(bestVotedOption(plan.getId(), OptionType.DATE),
                    bestVotedOption(plan.getId(), OptionType.PLACE));
        } catch (InvalidOperationException unavailable) {
            return null;
        }
    }

    @Transactional(readOnly = true)
    public Map<Long, AgreementDto> selectedAgreements(List<Long> planIds) {
        if (planIds.isEmpty()) return Map.of();
        return optionRepository.findByPlanIdInAndSelectedTrue(planIds).stream()
                .collect(Collectors.groupingBy(option -> option.getPlan().getId()))
                .entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, entry -> {
                    PlanOption date = entry.getValue().stream().filter(option -> option.getType() == OptionType.DATE)
                            .findFirst().orElse(null);
                    PlanOption place = entry.getValue().stream().filter(option -> option.getType() == OptionType.PLACE)
                            .findFirst().orElse(null);
                    return agreement(date, place);
                }));
    }

    private AgreementDto agreement(PlanOption date, PlanOption place) {
        return new AgreementDto(date == null ? null : date.getEffectiveDate(),
                date == null || date.getStartsAt() == null ? null : date.getStartsAt().toLocalTime(),
                place == null ? null : place.getLabel());
    }

    private PlanOption bestVotedOption(Long planId, OptionType type) {
        long participants = participantRepository.countByPlanIdAndStatus(planId, ParticipationStatus.JOINED);
        return optionRepository.findByPlanIdAndType(planId, type).stream()
                .filter(option -> type != OptionType.DATE || option.isUpcoming(ZoneId.of(timeZone)))
                .filter(option -> type != OptionType.PLACE || option.getLocation() != null)
                .filter(option -> voteRepository.countByOptionId(option.getId()) > 0)
                .max(Comparator.<PlanOption>comparingLong(option -> voteRepository.countByOptionId(option.getId()))
                        .thenComparingInt(option -> feasibilityService.calculateOptionScore(option,
                                voteRepository.countByOptionId(option.getId()), participants))
                        .thenComparing(option -> -option.getId()))
                .orElseThrow(() -> new InvalidOperationException("A voted day and place are required before closing"));
    }

    private void validateOption(OptionRequestDto dto) {
        if (dto.getType() == OptionType.DATE && dto.getStartsAt() == null && dto.getStartsOn() == null) {
            throw new InvalidOperationException("A DATE option requires a day; the time is optional");
        }
        if (dto.getType() == OptionType.PLACE && dto.getLocation() == null) {
            throw new InvalidOperationException("A PLACE option requires a location");
        }
        if (dto.getType() == OptionType.DATE && dto.getLocation() != null)
            throw new InvalidOperationException("A DATE option cannot contain a place");
        if (dto.getType() == OptionType.PLACE && (dto.getStartsAt() != null || dto.getStartsOn() != null || dto.getEndsAt() != null || dto.getEndsOn() != null))
            throw new InvalidOperationException("A PLACE option cannot contain dates");
        if (dto.getEndsAt() != null && dto.getStartsAt() == null)
            throw new InvalidOperationException("A final time requires an initial time");
        if (dto.getStartsAt() != null && dto.getEndsAt() != null && !dto.getEndsAt().isAfter(dto.getStartsAt())) {
            throw new InvalidOperationException("endsAt must be after startsAt");
        }
        if (dto.getStartsOn() != null && dto.getStartsAt() != null && !dto.getStartsOn().equals(dto.getStartsAt().toLocalDate())) {
            throw new InvalidOperationException("startsOn and startsAt must refer to the same day");
        }
        if (dto.getEndsOn() != null && dto.getEndsAt() != null && !dto.getEndsOn().equals(dto.getEndsAt().toLocalDate())) {
            throw new InvalidOperationException("endsOn and endsAt must refer to the same day");
        }
        LocalDate start = dto.getStartsOn() != null ? dto.getStartsOn() : dto.getStartsAt() == null ? null : dto.getStartsAt().toLocalDate();
        LocalDate end = dto.getEndsOn() != null ? dto.getEndsOn() : dto.getEndsAt() == null ? null : dto.getEndsAt().toLocalDate();
        if (start != null && end != null && end.isBefore(start)) throw new InvalidOperationException("The final day cannot precede the initial day");
    }

    private OptionResponseDto toResponse(PlanOption option, long participants) {
        OptionResponseDto response = modelMapper.map(option, OptionResponseDto.class);
        long votes = voteRepository.countByOptionId(option.getId());
        response.setVoteCount(votes);
        response.setScore(feasibilityService.calculateOptionScore(option, votes, participants));
        return response;
    }
}
