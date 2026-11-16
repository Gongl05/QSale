package com.example.qsale.commitment.domain;

import com.example.qsale.commitment.dto.CommitmentRequestDto;
import com.example.qsale.commitment.dto.CommitmentResponseDto;
import com.example.qsale.commitment.infrastructure.CommitmentResponseRepository;
import com.example.qsale.participant.domain.ParticipantService;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.plan.domain.PlanAccessService;
import com.example.qsale.plan.domain.PlanStatus;
import com.example.qsale.notification.domain.NotificationService;
import com.example.qsale.notification.domain.NotificationType;
import com.example.qsale.plan.events.PlanChangedEvent;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CommitmentService {

    private final CommitmentResponseRepository commitmentRepository;
    private final PlanAccessService planAccessService;
    private final ParticipantService participantService;
    private final UserService userService;
    private final ApplicationEventPublisher eventPublisher;
    private final ModelMapper modelMapper;
    private final NotificationService notificationService;

    @PreAuthorize("@planAuthorization.isJoined(#planId, authentication)")
    @Transactional
    public CommitmentResponseDto respond(Long planId, CommitmentRequestDto dto) {
        User user = userService.getCurrentUser();
        Plan plan = planAccessService.lockAsMember(planId, user);
        planAccessService.requireNotCancelled(plan);
        participantService.requireJoined(planId, user);
        long before = commitmentRepository.countByPlanIdAndStatus(planId, CommitmentStatus.CONFIRMED);

        CommitmentResponse commitment = commitmentRepository.findByPlanIdAndUserId(planId, user.getId())
                .orElseGet(() -> new CommitmentResponse(plan, user, dto.getStatus()));
        commitment.setStatus(dto.getStatus());
        if (dto.getNote() != null) commitment.setNote(dto.getNote());
        commitment.setRespondedAt(LocalDateTime.now());
        commitmentRepository.save(commitment);
        long after = commitmentRepository.countByPlanIdAndStatus(planId, CommitmentStatus.CONFIRMED);
        if (plan.getStatus() == PlanStatus.CLOSED && before >= plan.getMinParticipants() && after < plan.getMinParticipants()) {
            notificationService.notifyOrganizer(plan, NotificationType.ATTENDANCE_BELOW_MINIMUM,
                    "El plan " + plan.getName() + " tiene " + after + " confirmaciones; necesita " + plan.getMinParticipants()
                    + ". El día y lugar se conservan. Puedes proponer una reprogramación o reabrir el plan para invitar a alguien.");
        }
        eventPublisher.publishEvent(new PlanChangedEvent(this, plan.getId()));
        return modelMapper.map(commitment, CommitmentResponseDto.class);
    }

    @PreAuthorize("@planAuthorization.isMember(#planId, authentication)")
    @Transactional(readOnly = true)
    public List<CommitmentResponseDto> getCommitments(Long planId) {
        planAccessService.getPlanAsMember(planId, userService.getCurrentUser());
        return commitmentRepository.findByPlanId(planId).stream()
                .map(commitment -> modelMapper.map(commitment, CommitmentResponseDto.class))
                .toList();
    }
}
