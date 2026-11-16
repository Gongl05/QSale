package com.example.qsale.auth.domain;

import com.example.qsale.auth.dto.RefreshTokenRequest;
import com.example.qsale.auth.dto.SignInRequest;
import com.example.qsale.auth.dto.SignUpRequest;
import com.example.qsale.auth.dto.TokenResponse;
import com.example.qsale.exceptions.DuplicateResourceException;
import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.exceptions.UnauthorizedException;
import com.example.qsale.user.domain.Role;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.events.UserRegisteredEvent;
import com.example.qsale.user.infrastructure.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthSessionService sessions;
    private final ApplicationEventPublisher eventPublisher;
    private final LoginProtectionService loginProtection;

    @Transactional
    public TokenResponse signUp(SignUpRequest request) {
        if (request.getPassword().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new InvalidOperationException("Password must not exceed 72 UTF-8 bytes");
        }
        String email = request.getEmail().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmail(email)) {
            throw new DuplicateResourceException("Email " + email + " is already registered");
        }
        User user = new User(request.getName(), email, passwordEncoder.encode(request.getPassword()), Role.USER);
        userRepository.save(user);
        eventPublisher.publishEvent(new UserRegisteredEvent(this, user.getId()));
        return buildTokens(user);
    }

    public TokenResponse signIn(SignInRequest request) {
        String email = request.getEmail().toLowerCase(Locale.ROOT);
        return buildTokens(loginProtection.authenticate(email, request.getPassword()));
    }

    public TokenResponse refresh(RefreshTokenRequest request) {
        return sessions.refresh(request.getRefreshToken());
    }

    public void signOut(RefreshTokenRequest request) {
        sessions.revoke(request.getRefreshToken());
    }

    private TokenResponse buildTokens(User user) {
        return sessions.issue(user);
    }
}
