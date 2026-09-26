package com.example.qsale.user.events;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class UserRegisteredEvent extends ApplicationEvent {

    private final Long userId;

    public UserRegisteredEvent(Object source, Long userId) {
        super(source);
        this.userId = userId;
    }
}
