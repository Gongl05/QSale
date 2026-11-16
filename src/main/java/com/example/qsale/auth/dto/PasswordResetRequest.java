package com.example.qsale.auth.dto;

import jakarta.validation.constraints.*;

public record PasswordResetRequest(@NotBlank @Email @Size(max = 150) String email) {}
