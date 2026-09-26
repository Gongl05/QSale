package com.example.qsale.option.events;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class TravelEstimateRefreshRequestedEvent extends ApplicationEvent {

    private final Long planId;

    public TravelEstimateRefreshRequestedEvent(Object source, Long planId) {
        super(source);
        this.planId = planId;
    }
}
