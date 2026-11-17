package com.example.qsale.user.dto;

import com.example.qsale.location.dto.LocationDto;
import com.example.qsale.user.domain.Gender;
import com.example.qsale.user.domain.Role;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class UserResponseDto {
    private Long id;
    private String name;
    private String surname;
    private String nickname;
    private String email;
    private String phone;
    private LocalDate birthDate;
    private Gender gender;
    private Long avatarVersion;
    private Role role;
    private LocalDateTime createdAt;
    private LocationDto location;
}
