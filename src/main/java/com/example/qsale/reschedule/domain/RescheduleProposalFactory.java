package com.example.qsale.reschedule.domain;

import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.location.dto.LocationDto;
import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.domain.PlanOption;
import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.reschedule.dto.RescheduleDtos;
import com.example.qsale.user.domain.User;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RescheduleProposalFactory {
    private final PlanOptionRepository options;
    private final ModelMapper mapper;

    @Value("${plans.time-zone:America/Lima}")
    private String timeZone = "America/Lima";

    public RescheduleProposal create(Plan plan, User user, RescheduleDtos.Request request) {
        PlanOption currentDate = selected(plan.getId(), OptionType.DATE);
        PlanOption currentPlace = selected(plan.getId(), OptionType.PLACE);
        LocalDate day = request.date() == null ? currentDate.getEffectiveDate() : request.date();
        validateDate(day, request.time());
        RescheduleProposal proposal = initialize(plan, user, request, day);
        preserveDuration(proposal, currentDate);
        selectPlace(proposal, request, currentPlace);
        requireChanged(proposal, currentDate, currentPlace);
        proposal.setExpiresAt(expiry(day, request.time(), request.expiresAt()));
        return proposal;
    }

    private RescheduleProposal initialize(Plan plan, User user, RescheduleDtos.Request request, LocalDate day) {
        RescheduleProposal proposal = new RescheduleProposal();
        proposal.setPlan(plan);
        proposal.setCreatedBy(user);
        proposal.setBaseAgreementVersion(plan.getAgreementVersion());
        proposal.setProposedDate(day);
        proposal.setProposedTime(request.time());
        proposal.setReason(request.reason());
        return proposal;
    }

    private void validateDate(LocalDate day, LocalTime time) {
        if (day == null || day.isBefore(LocalDate.now(ZoneId.of(timeZone)))) {
            throw new InvalidOperationException("Choose today or a future day");
        }
        if (time != null && !day.atTime(time).atZone(ZoneId.of(timeZone)).toInstant().isAfter(Instant.now())) {
            throw new InvalidOperationException("Choose a future time or leave it unspecified");
        }
    }

    private void selectPlace(RescheduleProposal proposal, RescheduleDtos.Request request, PlanOption currentPlace) {
        if (request.location() != null && request.placeOptionId() != null) {
            throw new InvalidOperationException("Choose an existing place or a new location, not both");
        }
        if (request.location() != null) {
            if (request.placeLabel() == null || request.placeLabel().isBlank()) {
                throw new InvalidOperationException("A new place needs a name");
            }
            proposal.setPlaceLabel(request.placeLabel().strip());
            copyLocation(proposal, request.location());
            return;
        }
        PlanOption place = request.placeOptionId() == null ? currentPlace
                : findPlace(proposal.getPlan().getId(), request.placeOptionId());
        proposal.setPlaceOptionId(place.getId());
        proposal.setPlaceLabel(place.getLabel());
        copyLocation(proposal, mapper.map(place.getLocation(), LocationDto.class));
    }

    private PlanOption findPlace(Long planId, Long optionId) {
        return options.findByIdAndPlanId(optionId, planId)
                .filter(option -> option.getType() == OptionType.PLACE && option.getLocation() != null)
                .orElseThrow(() -> new InvalidOperationException("Choose a place from this plan"));
    }

    private void requireChanged(RescheduleProposal proposal, PlanOption currentDate, PlanOption currentPlace) {
        LocalTime currentTime = currentDate.getStartsAt() == null ? null : currentDate.getStartsAt().toLocalTime();
        if (proposal.getProposedDate().equals(currentDate.getEffectiveDate())
                && Objects.equals(proposal.getProposedTime(), currentTime)
                && Objects.equals(proposal.getPlaceOptionId(), currentPlace.getId())) {
            throw new InvalidOperationException("The proposal must change the day, time or place");
        }
    }

    private Instant expiry(LocalDate day, LocalTime time, Instant requested) {
        Instant endOfDay = day.plusDays(1).atStartOfDay(ZoneId.of(timeZone)).toInstant();
        Instant lastPossibleVote = time == null ? endOfDay : day.atTime(time).atZone(ZoneId.of(timeZone)).toInstant();
        Instant result = requested == null ? endOfDay : requested;
        if (result.isAfter(lastPossibleVote)) result = lastPossibleVote;
        if (!result.isAfter(Instant.now())) {
            throw new InvalidOperationException("The voting deadline must be in the future");
        }
        return result;
    }

    private void preserveDuration(RescheduleProposal proposal, PlanOption currentDate) {
        LocalDate endDay = currentDate.getEffectiveEndDate();
        if (endDay == null) return;
        long dayShift = ChronoUnit.DAYS.between(currentDate.getEffectiveDate(), proposal.getProposedDate());
        if (currentDate.getStartsAt() != null && currentDate.getEndsAt() != null && proposal.getProposedTime() != null) {
            Duration duration = Duration.between(currentDate.getStartsAt(), currentDate.getEndsAt());
            LocalDateTime end = proposal.getProposedDate().atTime(proposal.getProposedTime()).plus(duration);
            proposal.setProposedEndDate(end.toLocalDate());
            proposal.setProposedEndTime(end.toLocalTime());
        } else {
            proposal.setProposedEndDate(endDay.plusDays(dayShift));
        }
    }

    private PlanOption selected(Long planId, OptionType type) {
        return options.findByPlanIdAndType(planId, type).stream()
                .filter(PlanOption::isSelected).findFirst()
                .orElseThrow(() -> new InvalidOperationException("Reopen the plan to choose its missing day or place"));
    }

    private void copyLocation(RescheduleProposal proposal, LocationDto location) {
        proposal.setLatitude(location.getLatitude());
        proposal.setLongitude(location.getLongitude());
        proposal.setAddress(location.getAddress());
    }
}
