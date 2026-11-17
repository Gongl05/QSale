package com.example.qsale.participant.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class OriginRequestDto {

    // One of the user's saved addresses, or null to start from their main address.
    private Long addressId;
}
