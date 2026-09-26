package com.example.qsale.auth;

import com.example.qsale.auth.components.JwtService;
import com.example.qsale.auth.domain.AuthService;
import com.example.qsale.auth.dto.RefreshTokenRequest;
import com.example.qsale.auth.dto.SignUpRequest;
import com.example.qsale.auth.dto.TokenResponse;
import com.example.qsale.exceptions.DuplicateResourceException;
import com.example.qsale.exceptions.UnauthorizedException;
import com.example.qsale.user.domain.Role;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import com.example.qsale.user.events.UserRegisteredEvent;
import com.example.qsale.user.infrastructure.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserService userService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private AuthService authService;

    @Test
    void signUpShouldRejectAlreadyRegisteredEmail() {
        SignUpRequest request = buildSignUpRequest("ana@utec.edu.pe");
        when(userRepository.existsByEmail("ana@utec.edu.pe")).thenReturn(true);

        assertThrows(DuplicateResourceException.class, () -> authService.signUp(request));

        verify(userRepository, never()).save(any());
    }

    @Test
    void signUpShouldStoreEncodedPasswordAndPublishEvent() {
        SignUpRequest request = buildSignUpRequest("ANA@UTEC.EDU.PE");
        when(userRepository.existsByEmail("ana@utec.edu.pe")).thenReturn(false);
        when(passwordEncoder.encode("Secret123")).thenReturn("hashed-password");
        when(jwtService.generateAccessToken(any(User.class))).thenReturn("access-token");
        when(jwtService.generateRefreshToken(any(User.class))).thenReturn("refresh-token");

        TokenResponse response = authService.signUp(request);

        ArgumentCaptor<User> savedUser = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(savedUser.capture());
        assertEquals("ana@utec.edu.pe", savedUser.getValue().getEmail());
        assertEquals("hashed-password", savedUser.getValue().getPassword());
        assertEquals(Role.USER, savedUser.getValue().getRole());
        verify(eventPublisher).publishEvent(any(UserRegisteredEvent.class));
        assertEquals("access-token", response.token());
        assertEquals("refresh-token", response.refreshToken());
    }

    @Test
    void refreshShouldRejectInvalidToken() {
        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken("not-a-valid-token");
        when(jwtService.isRefreshTokenValid("not-a-valid-token")).thenReturn(false);

        assertThrows(UnauthorizedException.class, () -> authService.refresh(request));
    }

    private SignUpRequest buildSignUpRequest(String email) {
        SignUpRequest request = new SignUpRequest();
        request.setName("Ana Torres");
        request.setEmail(email);
        request.setPassword("Secret123");
        return request;
    }
}
