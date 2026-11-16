package com.example.qsale.jobs;

import com.example.qsale.exceptions.*;
import com.example.qsale.notification.domain.*;
import com.example.qsale.notification.infrastructure.NotificationRepository;
import com.example.qsale.option.domain.*;
import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.plan.domain.FeasibilityService;
import java.time.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service @RequiredArgsConstructor
public class BackgroundJobExecutor {
    private final BackgroundJobRepository jobs;
    private final BackgroundQueue queue;
    private final ObjectMapper json;
    private final FeasibilityService feasibility;
    private final NotificationService notifications;
    private final EmailService email;
    private final NotificationRepository notificationRepository;
    private final PlanOptionService options;
    private final PlanOptionRepository optionRepository;
    private final com.example.qsale.auth.domain.PasswordRecoveryService recovery;

    @Transactional
    public void execute(String id) {
        BackgroundJob job=jobs.findForUpdate(id).orElseThrow();
        if(!job.getStatus().equals("RUNNING")) return;
        JobPayload payload=json.readValue(job.getPayload(),JobPayload.class);
        dispatch(job.getType(),payload);
        job.setStatus("DONE");job.setCompletedAt(Instant.now());job.setLeaseUntil(null);job.setLastError(null);
    }

    private void dispatch(String type,JobPayload payload) {
        switch(type) {
            case "FEASIBILITY" -> { if(feasibility.recalculate(payload.targetId())) notifications.notifyPlanReady(payload.targetId()); }
            case "TRAVEL_OPTION" -> options.updateTravelEstimate(payload.targetId());
            case "TRAVEL_PLAN" -> optionRepository.findByPlanIdAndType(payload.targetId(),OptionType.PLACE)
                    .forEach(option -> queue.enqueue("TRAVEL_OPTION",JobPayload.target(option.getId())));
            case "EMAIL" -> deliver(payload);
            case "PASSWORD_RECOVERY" -> recovery.deliverRequest(payload.email());
            default -> throw new IllegalArgumentException("Unknown background job type");
        }
    }

    private void deliver(JobPayload payload) {
        if(payload.notificationId()!=null && !notificationRepository.existsById(payload.notificationId())) return;
        if(!email.sendHtmlEmail(payload.email(),payload.subject(),payload.template(),payload.variables()))
            throw new ExternalServiceException("Email delivery failed");
        if(payload.notificationId()!=null) notificationRepository.findById(payload.notificationId()).ifPresent(notification -> {
            notification.setStatus(NotificationStatus.SENT);notification.setSentAt(LocalDateTime.now());
        });
    }
}
