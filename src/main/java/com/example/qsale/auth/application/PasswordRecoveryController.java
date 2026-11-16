package com.example.qsale.auth.application;

import com.example.qsale.auth.domain.PasswordRecoveryService;
import com.example.qsale.auth.dto.PasswordResetConfirmation;
import com.example.qsale.auth.dto.PasswordResetRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth/password-reset")
@RequiredArgsConstructor
public class PasswordRecoveryController {
    private final PasswordRecoveryService recovery;

    @PostMapping("/request")
    public ResponseEntity<Void> request(@Valid @RequestBody PasswordResetRequest request) {
        recovery.request(request.email());
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/confirm")
    public ResponseEntity<Void> confirm(@Valid @RequestBody PasswordResetConfirmation request) {
        recovery.confirm(request.token(), request.password());
        return ResponseEntity.noContent().build();
    }
}
