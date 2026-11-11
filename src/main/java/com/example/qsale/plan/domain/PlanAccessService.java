package com.example.qsale.plan.domain;

import com.example.qsale.exceptions.ForbiddenException;
import com.example.qsale.exceptions.ParticipantNotInPlanException;
import com.example.qsale.exceptions.PlanClosedException;
import com.example.qsale.exceptions.ResourceNotFoundException;
import com.example.qsale.participant.domain.PlanParticipant;
import com.example.qsale.participant.domain.ParticipationStatus;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.infrastructure.PlanRepository;
import com.example.qsale.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PlanAccessService {

    private final PlanRepository planRepository;
    private final PlanParticipantRepository participantRepository;

    public Plan getPlan(Long planId) {
        return planRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("Plan not found with id " + planId));
    }

    public Optional<Plan> findPlanForUpdate(Long planId) {
        return planRepository.findByIdForUpdate(planId);
    }

    public Plan getPlanAsMember(Long planId, User user) {
        Plan plan = getPlan(planId);
        if (!user.isAdmin() && !participantRepository.existsByPlanIdAndUserId(planId, user.getId())) {
            throw new ParticipantNotInPlanException("You are not a participant of plan " + planId);
        }
        return plan;
    }

    public Plan getPlanAsOrganizer(Long planId, User user) {
        Plan plan = getPlan(planId);
        if (user.isAdmin()) {
            return plan;
        }
        PlanParticipant participant = participantRepository.findByPlanIdAndUserId(planId, user.getId())
                .orElseThrow(() -> new ParticipantNotInPlanException("You are not a participant of plan " + planId));
        if (!participant.isOrganizer() || participant.getStatus() != ParticipationStatus.JOINED) {
            throw new ForbiddenException("Only the organizer of plan " + planId + " can perform this action");
        }
        return plan;
    }

    public void requireOpen(Plan plan) {
        if (!plan.isOpen()) {
            throw new PlanClosedException("Plan " + plan.getId() + " is " + plan.getStatus() + " and cannot be modified");
        }
    }

    public void requireJoined(Long planId, User user) {
        boolean joined = participantRepository.findByPlanIdAndUserId(planId, user.getId())
                .map(participant -> participant.getStatus() == ParticipationStatus.JOINED)
                .orElse(false);
        if (!joined) {
            throw new ForbiddenException("You must join plan " + planId + " before performing this action");
        }
    }
}
