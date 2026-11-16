package com.example.qsale.auth.dto;

import jakarta.validation.constraints.*;

public record PasswordResetConfirmation(
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43}") String token,
        @NotBlank @Size(min = 8, max = 64)
        @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).+$") String password) {}
