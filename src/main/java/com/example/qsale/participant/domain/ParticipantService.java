package com.example.qsale.participant.domain;

import com.example.qsale.availability.infrastructure.AvailabilityRepository;
import com.example.qsale.commitment.infrastructure.CommitmentResponseRepository;
import com.example.qsale.exceptions.DuplicateResourceException;
import com.example.qsale.exceptions.ForbiddenException;
import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.exceptions.ResourceNotFoundException;
import com.example.qsale.option.events.TravelEstimateRefreshRequestedEvent;
import com.example.qsale.participant.dto.ParticipantInviteDto;
import com.example.qsale.participant.dto.ParticipantResponseDto;
import com.example.qsale.participant.events.ParticipantInvitedEvent;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.plan.domain.PlanAccessService;
import com.example.qsale.plan.events.PlanChangedEvent;
import com.example.qsale.plan.infrastructure.PlanRepository;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import com.example.qsale.vote.infrastructure.VoteRepository;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ParticipantService {

    private final PlanParticipantRepository participantRepository;
    private final VoteRepository voteRepository;
    private final AvailabilityRepository availabilityRepository;
    private final CommitmentResponseRepository commitmentRepository;
    private final PlanRepository planRepository;
    private final PlanAccessService planAccessService;
    private final UserService userService;
    private final ModelMapper modelMapper;
    private final ApplicationEventPublisher eventPublisher;

    @PreAuthorize("@planAuthorization.isOrganizer(#planId, authentication)")
    @Transactional
    public ParticipantResponseDto inviteParticipant(Long planId, ParticipantInviteDto dto) {
        Plan plan = planAccessService.getPlanAsOrganizer(planId, userService.getCurrentUser());
        planAccessService.requireOpen(plan);
        User invitee = userService.getUserByEmail(dto.getEmail().toLowerCase(Locale.ROOT));
        if (participantRepository.existsByPlanIdAndUserId(planId, invitee.getId())) {
            throw new DuplicateResourceException(invitee.getEmail() + " is already a participant of plan " + planId);
        }
        PlanParticipant participant = new PlanParticipant(plan, invitee, ParticipantRole.GUEST);
        participantRepository.save(participant);
        eventPublisher.publishEvent(new ParticipantInvitedEvent(this, planId, invitee.getId()));
        return toResponse(participant);
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ParticipantResponseDto joinByInviteCode(String inviteCode) {
        Plan plan = planRepository.findByInviteCode(inviteCode.toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("No plan found with invite code " + inviteCode));
        return join(plan, userService.getCurrentUser());
    }

    @PreAuthorize("@planAuthorization.isMember(#planId, authentication)")
    @Transactional
    public ParticipantResponseDto acceptInvitation(Long planId) {
        User user = userService.getCurrentUser();
        Plan plan = planAccessService.getPlanAsMember(planId, user);
        if (!participantRepository.existsByPlanIdAndUserId(planId, user.getId())) {
            throw new ForbiddenException("You have not been invited to plan " + planId);
        }
        return join(plan, user);
    }

    private ParticipantResponseDto join(Plan plan, User user) {
        planAccessService.requireOpen(plan);
        PlanParticipant participant = participantRepository.findByPlanIdAndUserId(plan.getId(), user.getId())
                .orElseGet(() -> new PlanParticipant(plan, user, ParticipantRole.GUEST));
        if (participant.getStatus() == ParticipationStatus.JOINED) {
            throw new DuplicateResourceException("You already joined plan " + plan.getId());
        }
        participant.setStatus(ParticipationStatus.JOINED);
        participant.setJoinedAt(LocalDateTime.now());
        participantRepository.save(participant);
        eventPublisher.publishEvent(new PlanChangedEvent(this, plan.getId()));
        eventPublisher.publishEvent(new TravelEstimateRefreshRequestedEvent(this, plan.getId()));
        return toResponse(participant);
    }

    @PreAuthorize("@planAuthorization.isMember(#planId, authentication)")
    @Transactional(readOnly = true)
    public List<ParticipantResponseDto> getParticipants(Long planId) {
        planAccessService.getPlanAsMember(planId, userService.getCurrentUser());
        return participantRepository.findByPlanId(planId).stream()
                .map(this::toResponse)
                .toList();
    }

    @PreAuthorize("@planAuthorization.canRemoveParticipant(#planId, #userId, authentication)")
    @Transactional
    public void removeParticipant(Long planId, Long userId) {
        User currentUser = userService.getCurrentUser();
        Plan plan = currentUser.getId().equals(userId)
                ? planAccessService.getPlanAsMember(planId, currentUser)
                : planAccessService.getPlanAsOrganizer(planId, currentUser);
        planAccessService.requireOpen(plan);

        PlanParticipant participant = participantRepository.findByPlanIdAndUserId(planId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("User " + userId + " is not in plan " + planId));
        if (participant.isOrganizer()) {
            throw new InvalidOperationException("The organizer cannot be removed from the plan");
        }
        voteRepository.deleteByOption_Plan_IdAndUser_Id(planId, userId);
        availabilityRepository.deleteByPlanIdAndUserId(planId, userId);
        commitmentRepository.deleteByPlanIdAndUserId(planId, userId);
        plan.getParticipants().remove(participant);
        eventPublisher.publishEvent(new PlanChangedEvent(this, plan.getId()));
        if (participant.getStatus() == ParticipationStatus.JOINED) {
            eventPublisher.publishEvent(new TravelEstimateRefreshRequestedEvent(this, plan.getId()));
        }
    }

    public void requireJoined(Long planId, User user) {
        planAccessService.requireJoined(planId, user);
    }

    private ParticipantResponseDto toResponse(PlanParticipant participant) {
        return modelMapper.map(participant, ParticipantResponseDto.class);
    }
}
