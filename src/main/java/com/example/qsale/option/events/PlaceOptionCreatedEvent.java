package com.example.qsale.option.events;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class PlaceOptionCreatedEvent extends ApplicationEvent {

    private final Long optionId;

    public PlaceOptionCreatedEvent(Object source, Long optionId) {
        super(source);
        this.optionId = optionId;
    }
}
