package com.example.qsale.plan.events;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class PlanStatusChangedEvent extends ApplicationEvent {

    private final Long planId;

    public PlanStatusChangedEvent(Object source, Long planId) {
        super(source);
        this.planId = planId;
    }
}
