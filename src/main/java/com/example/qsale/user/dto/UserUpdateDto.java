package com.example.qsale.user.dto;

import com.example.qsale.location.dto.LocationDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UserUpdateDto {

    @NotBlank
    @Size(min = 2, max = 100)
    private String name;

    @Valid
    private LocationDto location;
}
