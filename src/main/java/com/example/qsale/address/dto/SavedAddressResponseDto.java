package com.example.qsale.address.dto;

import com.example.qsale.address.domain.AddressType;
import com.example.qsale.location.dto.LocationDto;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SavedAddressResponseDto {
    private Long id;
    private String label;
    private AddressType type;
    private boolean favorite;
    private boolean main;
    private LocationDto location;
}
