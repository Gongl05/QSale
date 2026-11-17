package com.example.qsale.user.dto;

import com.example.qsale.user.domain.Gender;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * Full profile edit from the mobile app. The email is not here on purpose: it cannot be changed.
 * Names only accept letters, spaces, apostrophes and hyphens so people use their real names.
 */
@Getter
@Setter
@NoArgsConstructor
public class ProfileUpdateDto {

    public static final String NAME_PATTERN = "^[\\p{L}]+([ '\\-][\\p{L}]+)*$";

    @NotBlank
    @Size(min = 2, max = 100)
    @Pattern(regexp = NAME_PATTERN, message = "must only contain letters")
    private String name;

    @Size(max = 100)
    @Pattern(regexp = NAME_PATTERN, message = "must only contain letters")
    private String surname;

    @Size(max = 30)
    @Pattern(regexp = NAME_PATTERN, message = "must only contain letters")
    private String nickname;

    @Pattern(regexp = "^\\+?[0-9 ]{6,19}$", message = "must be a valid phone number")
    private String phone;

    @Past
    private LocalDate birthDate;

    private Gender gender;
}
