package com.example.qsale.option.dto;

import com.example.qsale.location.dto.LocationDto;
import com.example.qsale.option.domain.OptionType;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class OptionResponseDto {
    private Long id;
    private OptionType type;
    private String label;
    private String description;
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
    private LocationDto location;
    private Double avgDistanceKm;
    private Integer avgTravelMinutes;
    private boolean selected;
    private String proposedByName;
    private long voteCount;
    private int score;
}
