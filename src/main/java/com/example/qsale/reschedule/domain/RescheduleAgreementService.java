package com.example.qsale.reschedule.domain;

import com.example.qsale.commitment.domain.*;
import com.example.qsale.commitment.infrastructure.CommitmentResponseRepository;
import com.example.qsale.location.domain.Location;
import com.example.qsale.location.domain.TravelEstimateStatus;
import com.example.qsale.location.dto.LocationDto;
import com.example.qsale.option.domain.*;
import com.example.qsale.option.events.PlaceOptionCreatedEvent;
import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.participant.domain.*;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.reschedule.infrastructure.RescheduleVoteRepository;
import com.example.qsale.vote.domain.Vote;
import com.example.qsale.vote.infrastructure.VoteRepository;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

@Service
@RequiredArgsConstructor
public class RescheduleAgreementService {
    private final PlanOptionRepository options;
    private final PlanParticipantRepository participants;
    private final RescheduleVoteRepository ballots;
    private final CommitmentResponseRepository commitments;
    private final VoteRepository votes;
    private final ModelMapper mapper;
    private final ApplicationEventPublisher events;

    @Transactional(propagation = Propagation.MANDATORY)
    public void apply(Plan plan, RescheduleProposal proposal) {
        options.findByPlanId(plan.getId()).forEach(option -> option.setSelected(false));
        PlanOption day = createDay(plan, proposal);
        PlanOption place = selectPlace(plan, proposal);
        Map<Long, RescheduleVote> choices = ballots.findByProposalId(proposal.getId()).stream()
                .collect(Collectors.toMap(ballot -> ballot.getUser().getId(), Function.identity()));
        participants.findByPlanId(plan.getId()).stream()
                .filter(member -> member.getStatus() == ParticipationStatus.JOINED)
                .forEach(member -> applyAttendance(plan, day, place, member, choices.get(member.getUser().getId())));
        plan.setTentativeStartDate(proposal.getProposedDate());
        plan.setTentativeEndDate(proposal.getProposedEndDate());
        plan.setAgreementVersion(plan.getAgreementVersion() + 1);
        plan.setClosedAt(LocalDateTime.now());
    }

    private PlanOption createDay(Plan plan, RescheduleProposal proposal) {
        PlanOption day = new PlanOption();
        day.setPlan(plan);
        day.setProposedBy(proposal.getCreatedBy());
        day.setType(OptionType.DATE);
        day.setLabel("Nueva fecha: " + proposal.getProposedDate());
        day.setStartsOn(proposal.getProposedDate());
        day.setEndsOn(proposal.getProposedEndDate());
        if (proposal.getProposedEndDate() != null && proposal.getProposedEndTime() != null) {
            day.setEndsAt(proposal.getProposedEndDate().atTime(proposal.getProposedEndTime()));
        }
        if (proposal.getProposedTime() != null) day.setStartsAt(proposal.getProposedDate().atTime(proposal.getProposedTime()));
        day.setSelected(true);
        plan.addOption(day);
        return options.saveAndFlush(day);
    }

    private PlanOption selectPlace(Plan plan, RescheduleProposal proposal) {
        PlanOption place = proposal.getPlaceOptionId() == null ? null
                : options.findByIdAndPlanId(proposal.getPlaceOptionId(), plan.getId()).orElse(null);
        if (place == null) place = createPlace(plan, proposal);
        place.setSelected(true);
        return place;
    }

    private PlanOption createPlace(Plan plan, RescheduleProposal proposal) {
        PlanOption place = new PlanOption();
        place.setPlan(plan);
        place.setProposedBy(proposal.getCreatedBy());
        place.setType(OptionType.PLACE);
        place.setLabel(proposal.getPlaceLabel());
        place.setLocation(mapper.map(location(proposal), Location.class));
        place.setEstimateStatus(TravelEstimateStatus.PENDING);
        plan.addOption(place);
        options.saveAndFlush(place);
        events.publishEvent(new PlaceOptionCreatedEvent(this, place.getId()));
        return place;
    }

    private void applyAttendance(Plan plan, PlanOption day, PlanOption place, PlanParticipant member, RescheduleVote choice) {
        CommitmentStatus status = choice == null ? CommitmentStatus.INTERESTED
                : choice.isAccepted() ? CommitmentStatus.CONFIRMED : CommitmentStatus.CANT_GO;
        CommitmentResponse commitment = commitments.findByPlanIdAndUserId(plan.getId(), member.getUser().getId())
                .orElseGet(() -> new CommitmentResponse(plan, member.getUser(), status));
        commitment.setStatus(status);
        commitment.setRespondedAt(LocalDateTime.now());
        commitments.save(commitment);
        if (status == CommitmentStatus.CONFIRMED) {
            votes.save(new Vote(day, member.getUser()));
            if (!votes.existsByOptionIdAndUserId(place.getId(), member.getUser().getId())) {
                votes.save(new Vote(place, member.getUser()));
            }
        }
    }

    public static LocationDto location(RescheduleProposal proposal) {
        LocationDto location = new LocationDto();
        location.setLatitude(proposal.getLatitude());
        location.setLongitude(proposal.getLongitude());
        location.setAddress(proposal.getAddress());
        return location;
    }
}
