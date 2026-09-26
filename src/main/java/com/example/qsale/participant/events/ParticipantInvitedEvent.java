package com.example.qsale.participant.events;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class ParticipantInvitedEvent extends ApplicationEvent {

    private final Long planId;

    private final Long userId;

    public ParticipantInvitedEvent(Object source, Long planId, Long userId) {
        super(source);
        this.planId = planId;
        this.userId = userId;
    }
}
