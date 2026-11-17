package com.example.qsale.address.dto;

import com.example.qsale.address.domain.AddressType;
import com.example.qsale.location.dto.LocationDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SavedAddressRequestDto {

    @NotBlank
    @Size(max = 40)
    private String label;

    @NotNull
    private AddressType type;

    private boolean favorite;

    // true makes this the main address. The current main address stays main until another one takes its place.
    private boolean main;

    @NotNull
    @Valid
    private LocationDto location;
}
