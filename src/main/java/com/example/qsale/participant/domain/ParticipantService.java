package com.example.qsale.participant.domain;

import com.example.qsale.exceptions.DuplicateResourceException;
import com.example.qsale.exceptions.ForbiddenException;
import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.exceptions.ResourceNotFoundException;
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
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ParticipantService {

    private final PlanParticipantRepository participantRepository;
    private final PlanRepository planRepository;
    private final PlanAccessService planAccessService;
    private final UserService userService;
    private final ModelMapper modelMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public ParticipantResponseDto inviteParticipant(Long planId, ParticipantInviteDto dto) {
        Plan plan = planAccessService.getPlanAsOrganizer(planId, userService.getCurrentUser());
        planAccessService.requireOpen(plan);
        User invitee = userService.getUserByEmail(dto.getEmail().toLowerCase());
        if (participantRepository.existsByPlanIdAndUserId(planId, invitee.getId())) {
            throw new DuplicateResourceException(invitee.getEmail() + " is already a participant of plan " + planId);
        }
        PlanParticipant participant = new PlanParticipant(plan, invitee, ParticipantRole.GUEST);
        participantRepository.save(participant);
        eventPublisher.publishEvent(new ParticipantInvitedEvent(this, planId, invitee.getId()));
        return toResponse(participant);
    }

    @Transactional
    public ParticipantResponseDto joinByInviteCode(String inviteCode) {
        Plan plan = planRepository.findByInviteCode(inviteCode.toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("No plan found with invite code " + inviteCode));
        return join(plan, userService.getCurrentUser());
    }

    @Transactional
    public ParticipantResponseDto acceptInvitation(Long planId) {
        User user = userService.getCurrentUser();
        return join(planAccessService.getPlanAsMember(planId, user), user);
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
        return toResponse(participant);
    }

    public List<ParticipantResponseDto> getParticipants(Long planId) {
        planAccessService.getPlanAsMember(planId, userService.getCurrentUser());
        return participantRepository.findByPlanId(planId).stream()
                .map(this::toResponse)
                .toList();
    }

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
        plan.getParticipants().remove(participant);
        eventPublisher.publishEvent(new PlanChangedEvent(this, plan.getId()));
    }

    public void requireJoined(Long planId, User user) {
        boolean joined = participantRepository.findByPlanIdAndUserId(planId, user.getId())
                .map(participant -> participant.getStatus() == ParticipationStatus.JOINED)
                .orElse(false);
        if (!joined) {
            throw new ForbiddenException("You must join plan " + planId + " before performing this action");
        }
    }

    private ParticipantResponseDto toResponse(PlanParticipant participant) {
        return modelMapper.map(participant, ParticipantResponseDto.class);
    }
}
