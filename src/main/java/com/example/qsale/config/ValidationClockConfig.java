package com.example.qsale.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.validation.autoconfigure.ValidationConfigurationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class ValidationClockConfig {

    @Bean
    ValidationConfigurationCustomizer planValidationClock(
            @Value("${plans.time-zone:America/Lima}") String timeZone) {
        Clock clock = Clock.system(ZoneId.of(timeZone));
        return configuration -> configuration.clockProvider(() -> clock);
    }
}
