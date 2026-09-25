package com.example.qsale.user.dto;

import com.example.qsale.user.domain.Role;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class RoleUpdateDto {

    @NotNull
    private Role role;
}
