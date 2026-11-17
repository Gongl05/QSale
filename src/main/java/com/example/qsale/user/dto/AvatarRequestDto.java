package com.example.qsale.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class AvatarRequestDto {

    @NotBlank
    @Pattern(regexp = "image/(jpeg|png|webp)")
    private String contentType;

    // Base64 image; about 1.5 MB once decoded. The app resizes pictures before sending them.
    @NotBlank
    @Size(max = 2_000_000)
    private String data;
}
