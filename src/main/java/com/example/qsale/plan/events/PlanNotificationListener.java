package com.example.qsale.plan.events;

import com.example.qsale.notification.domain.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class PlanNotificationListener {

    private final NotificationService notificationService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void notifyPlanUpdated(PlanUpdatedEvent event) {
        notificationService.notifyPlanUpdated(event.getPlanId());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void notifyPlanStatusChanged(PlanStatusChangedEvent event) {
        notificationService.notifyPlanStatusChanged(event.getPlanId());
    }
}
