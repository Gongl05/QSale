package com.example.qsale.option.events;

import com.example.qsale.option.domain.PlanOptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class PlaceOptionListener {

    private final PlanOptionService planOptionService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void calculateTravelEstimate(PlaceOptionCreatedEvent event) {
        planOptionService.updateTravelEstimate(event.getOptionId());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void refreshPlanTravelEstimates(TravelEstimateRefreshRequestedEvent event) {
        planOptionService.updatePlanTravelEstimates(event.getPlanId());
    }
}
