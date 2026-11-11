package com.example.qsale.auth.domain;

import com.example.qsale.auth.components.JwtService;
import com.example.qsale.auth.dto.RefreshTokenRequest;
import com.example.qsale.auth.dto.SignInRequest;
import com.example.qsale.auth.dto.SignUpRequest;
import com.example.qsale.auth.dto.TokenResponse;
import com.example.qsale.exceptions.DuplicateResourceException;
import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.exceptions.UnauthorizedException;
import com.example.qsale.user.domain.Role;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import com.example.qsale.user.events.UserRegisteredEvent;
import com.example.qsale.user.infrastructure.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final ApplicationEventPublisher eventPublisher;

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
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, request.getPassword()));
        return buildTokens(userService.getUserByEmail(email));
    }

    public TokenResponse refresh(RefreshTokenRequest request) {
        if (!jwtService.isRefreshTokenValid(request.getRefreshToken())) {
            throw new UnauthorizedException("Refresh token is invalid or expired");
        }
        String email = jwtService.extractUsername(request.getRefreshToken());
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("Refresh token is invalid or expired"));
        return buildTokens(user);
    }

    private TokenResponse buildTokens(User user) {
        return new TokenResponse(jwtService.generateAccessToken(user), jwtService.generateRefreshToken(user));
    }
}
