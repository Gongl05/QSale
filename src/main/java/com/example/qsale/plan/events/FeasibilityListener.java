package com.example.qsale.plan.events;

import com.example.qsale.notification.domain.NotificationService;
import com.example.qsale.plan.domain.FeasibilityService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class FeasibilityListener {

    private final FeasibilityService feasibilityService;
    private final NotificationService notificationService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void recalculateFeasibility(PlanChangedEvent event) {
        boolean becameReady = feasibilityService.recalculate(event.getPlanId());
        if (becameReady) {
            notificationService.notifyPlanReady(event.getPlanId());
        }
    }
}
