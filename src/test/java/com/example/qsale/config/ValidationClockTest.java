package com.example.qsale.config;

import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.dto.OptionRequestDto;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class ValidationClockTest {

    @Test
    void validatesPlanTimesInLimaIndependentlyOfTheServerTimeZone() {
        var configuration = Validation.byDefaultProvider().configure();
        new ValidationClockConfig().planValidationClock("America/Lima").customize(configuration);
        try (var factory = configuration.buildValidatorFactory()) {
            var option = new OptionRequestDto();
            option.setType(OptionType.DATE);
            option.setLabel("Esta tarde en Lima");
            option.setStartsAt(LocalDateTime.now(ZoneId.of("America/Lima")).plusMinutes(15));
            assertThat(factory.getValidator().validate(option)).isEmpty();

            option.setStartsAt(LocalDateTime.now(ZoneId.of("America/Lima")).minusMinutes(15));
            assertThat(factory.getValidator().validate(option))
                    .anyMatch(violation -> violation.getPropertyPath().toString().equals("startsAt"));
        }
    }
}
