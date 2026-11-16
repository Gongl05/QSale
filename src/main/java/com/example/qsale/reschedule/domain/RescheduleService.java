package com.example.qsale.reschedule.domain;

import com.example.qsale.exceptions.*;
import com.example.qsale.notification.domain.*;
import com.example.qsale.participant.domain.*;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.domain.*;
import com.example.qsale.reschedule.dto.RescheduleDtos;
import com.example.qsale.reschedule.infrastructure.*;
import com.example.qsale.user.domain.*;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RescheduleService {

    private final RescheduleRepository proposals;
    private final RescheduleVoteRepository ballots;
    private final PlanAccessService access;
    private final UserService users;
    private final PlanParticipantRepository participants;
    private final NotificationService notifications;
    private final RescheduleProposalFactory factory;
    private final RescheduleAgreementService agreements;

    @Value("${plans.time-zone:America/Lima}")
    private String timeZone = "America/Lima";

    @PreAuthorize("@planAuthorization.isMember(#planId, authentication)")
    @Transactional
    public List<RescheduleDtos.Response> list(Long planId) {
        User user = users.getCurrentUser();
        access.lockAsMember(planId, user);
        Set<Long> electorate = electorate(planId);
        return proposals
            .findByPlanIdOrderByIdDesc(planId)
            .stream()
            .map(proposal -> {
                resolve(proposal, electorate);
                return response(proposal, user, electorate);
            })
            .toList();
    }

    @PreAuthorize("@planAuthorization.isJoined(#planId, authentication)")
    @Transactional
    public RescheduleDtos.Response create(Long planId, RescheduleDtos.Request request) {
        User user = users.getCurrentUser();
        Plan plan = access.lockAsMember(planId, user);
        access.requireJoined(planId, user);
        requireConfirmed(plan);
        RescheduleProposal proposal = factory.create(plan, user, request);
        proposals.saveAndFlush(proposal);
        saveVote(proposal, user, true);
        Set<Long> electorate = electorate(planId);
        resolve(proposal, electorate);
        notifications.notifyJoinedParticipants(plan, NotificationType.RESCHEDULE_PROPOSED,
                user.getName() + " propuso cambiar " + plan.getName() + " al " + proposal.getProposedDate()
                + " en " + proposal.getPlaceLabel()
                + ". Vota si asistirías con ese cambio; el acuerdo actual se conserva.");
        return response(proposal, user, electorate);
    }

    @PreAuthorize("@planAuthorization.isJoined(#planId, authentication)")
    @Transactional
    public RescheduleDtos.Response vote(Long planId, Long proposalId, boolean accepted) {
        User user = users.getCurrentUser();
        access.lockAsMember(planId, user);
        access.requireJoined(planId, user);
        RescheduleProposal proposal = proposal(planId, proposalId);
        Set<Long> electorate = electorate(planId);
        resolve(proposal, electorate);
        requireActive(proposal);
        saveVote(proposal, user, accepted);
        resolve(proposal, electorate);
        return response(proposal, user, electorate);
    }

    @PreAuthorize("@planAuthorization.isOrganizer(#planId, authentication)")
    @Transactional
    public RescheduleDtos.Response apply(Long planId, Long proposalId) {
        User user = users.getCurrentUser();
        Plan plan = access.lockAsOrganizer(planId, user);
        RescheduleProposal proposal = proposal(planId, proposalId);
        Set<Long> electorate = electorate(planId);
        resolve(proposal, electorate);
        requireApplicable(proposal);
        agreements.apply(plan, proposal);
        proposal.setStatus(RescheduleStatus.APPLIED);
        proposals.findByPlanIdOrderByIdDesc(planId).stream()
                .filter(other -> other.getStatus().isActive())
                .forEach(other -> other.setStatus(RescheduleStatus.SUPERSEDED));
        notifications.notifyJoinedParticipants(plan, NotificationType.RESCHEDULE_APPLIED,
                "El organizador reprogramó " + plan.getName() + " para el " + proposal.getProposedDate()
                + " en " + proposal.getPlaceLabel()
                + ". Los votos afirmativos ya cuentan como confirmación. Revisa tu asistencia.");
        return response(proposal, user, electorate);
    }

    @PreAuthorize("@planAuthorization.isMember(#planId, authentication)")
    @Transactional
    public RescheduleDtos.Response withdraw(Long planId, Long proposalId) {
        User user = users.getCurrentUser();
        Plan plan = access.lockAsMember(planId, user);
        if (!isOrganizer(plan, user)) access.requireJoined(planId, user);
        RescheduleProposal proposal = proposal(planId, proposalId);
        Set<Long> electorate = electorate(planId);
        resolve(proposal, electorate);
        requireActive(proposal);
        if (
            !isOrganizer(plan, user) && !proposal.getCreatedBy().getId().equals(user.getId())
        ) throw new ForbiddenException("Only the author or organizer can withdraw this proposal");
        proposal.setStatus(RescheduleStatus.WITHDRAWN);
        return response(proposal, user, electorate);
    }

    private void resolve(RescheduleProposal proposal, Set<Long> electorate) {
        if (!proposal.getStatus().isActive()) return;
        Plan plan = proposal.getPlan();
        if (plan.getStatus() != PlanStatus.CLOSED || proposal.getBaseAgreementVersion() != plan.getAgreementVersion()) {
            proposal.setStatus(RescheduleStatus.SUPERSEDED);
            return;
        }
        if (!proposal.getExpiresAt().isAfter(Instant.now())) {
            proposal.setStatus(RescheduleStatus.EXPIRED);
            return;
        }
        List<RescheduleVote> votes = effectiveVotes(proposal, electorate);
        long yes = votes.stream().filter(RescheduleVote::isAccepted).count();
        if (votes.size() - yes > electorate.size() / 2) {
            reject(proposal);
        } else {
            proposal.setStatus(yes > electorate.size() / 2 && yes >= plan.getMinParticipants()
                    ? RescheduleStatus.APPROVED : RescheduleStatus.VOTING);
        }
    }

    private void reject(RescheduleProposal proposal) {
        proposal.setStatus(RescheduleStatus.REJECTED);
        notifications.notifyJoinedParticipants(proposal.getPlan(), NotificationType.RESCHEDULE_REJECTED,
                "La propuesta del " + proposal.getProposedDate() + " para " + proposal.getPlan().getName()
                + " fue rechazada por mayoría. El acuerdo vigente se conserva.");
    }

    private RescheduleDtos.Response response(RescheduleProposal proposal, User user, Set<Long> electorate) {
        List<RescheduleVote> votes = effectiveVotes(proposal, electorate);
        long yes = votes.stream().filter(RescheduleVote::isAccepted).count();
        Boolean mine = votes.stream().filter(vote -> vote.getUser().getId().equals(user.getId()))
                .map(RescheduleVote::isAccepted).findFirst().orElse(null);
        boolean organizer = isOrganizer(proposal.getPlan(), user);
        return new RescheduleDtos.Response(
                proposal.getId(), proposal.getPlan().getId(),
                proposal.getCreatedBy().getId(), proposal.getCreatedBy().getName(),
                proposal.getBaseAgreementVersion(), proposal.getProposedDate(), proposal.getProposedTime(),
                proposal.getProposedEndDate(), proposal.getProposedEndTime(),
                proposal.getPlaceOptionId(), proposal.getPlaceLabel(), RescheduleAgreementService.location(proposal),
                proposal.getReason(), proposal.getStatus(), yes, votes.size() - yes, electorate.size(),
                Math.max(electorate.size() / 2 + 1, proposal.getPlan().getMinParticipants()), mine,
                proposal.getStatus() == RescheduleStatus.APPROVED && organizer,
                proposal.getStatus().isActive() && (organizer || proposal.getCreatedBy().getId().equals(user.getId())),
                proposal.getCreatedAt(), proposal.getExpiresAt());
    }

    private List<RescheduleVote> effectiveVotes(RescheduleProposal proposal, Set<Long> electorate) {
        return ballots
            .findByProposalId(proposal.getId())
            .stream()
            .filter(v -> electorate.contains(v.getUser().getId()))
            .toList();
    }

    private Set<Long> electorate(Long planId) {
        return participants
            .findByPlanId(planId)
            .stream()
            .filter(p -> p.getStatus() == ParticipationStatus.JOINED)
            .map(p -> p.getUser().getId())
            .collect(Collectors.toSet());
    }

    private RescheduleProposal proposal(Long planId, Long id) {
        return proposals
            .findById(id)
            .filter(p -> p.getPlan().getId().equals(planId))
            .orElseThrow(() -> new ResourceNotFoundException("Proposal not found in this plan"));
    }

    private void saveVote(RescheduleProposal proposal, User user, boolean accepted) {
        RescheduleVote ballot = ballots
            .findByProposalIdAndUserId(proposal.getId(), user.getId())
            .orElseGet(RescheduleVote::new);
        ballot.setProposal(proposal);
        ballot.setUser(user);
        ballot.setAccepted(accepted);
        ballot.setUpdatedAt(Instant.now());
        ballots.saveAndFlush(ballot);
    }

    private void requireApplicable(RescheduleProposal proposal) {
        if (proposal.getStatus() != RescheduleStatus.APPROVED) {
            throw new InvalidOperationException("A majority and the minimum number of attendees must support this proposal");
        }
        if (proposal.getProposedDate().isBefore(LocalDate.now(ZoneId.of(timeZone)))) {
            throw new InvalidOperationException("The proposed day has already passed");
        }
    }

    private void requireConfirmed(Plan plan) {
        if (plan.getStatus() != PlanStatus.CLOSED) throw new InvalidOperationException(
            "Only a confirmed plan accepts rescheduling proposals"
        );
    }

    private void requireActive(RescheduleProposal proposal) {
        if (!proposal.getStatus().isActive()) throw new ConflictException(
            "This proposal is no longer open for voting"
        );
    }

    private boolean isOrganizer(Plan plan, User user) {
        return user.isAdmin() || plan.getCreator().getId().equals(user.getId());
    }

}
