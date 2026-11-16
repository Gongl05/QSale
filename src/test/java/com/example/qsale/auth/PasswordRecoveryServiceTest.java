package com.example.qsale.auth;

import com.example.qsale.auth.domain.*;
import com.example.qsale.auth.infrastructure.*;
import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.jobs.*;
import com.example.qsale.notification.domain.*;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.infrastructure.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PasswordRecoveryServiceTest {
    UserRepository users = mock(UserRepository.class);
    PasswordResetRepository resets = mock(PasswordResetRepository.class);
    AuthSessionRepository sessions = mock(AuthSessionRepository.class);
    PasswordEncoder encoder = mock(PasswordEncoder.class);
    BackgroundQueue queue = mock(BackgroundQueue.class);
    EmailService email = mock(EmailService.class);
    PasswordRecoveryService recovery;
    User user;

    @BeforeEach void setup() {
        recovery = new PasswordRecoveryService(users, resets, sessions, encoder, queue, email,
                new PublicLinks("https://quesale.test"));
        user = new User(); user.setId(7L); user.setName("Ana"); user.setEmail("ana@example.test");
    }

    @Test void publicRequestDoesNotLookUpAccountsAndThrottlesRepeatedAddresses() {
        recovery.request("  ANA@example.test ");
        recovery.request("ana@example.test");
        ArgumentCaptor<JobPayload> payload = ArgumentCaptor.forClass(JobPayload.class);
        verify(queue).enqueue(eq("PASSWORD_RECOVERY"), payload.capture());
        assertEquals("ana@example.test", payload.getValue().email());
        assertNull(payload.getValue().variables());
        verifyNoInteractions(users, resets, sessions, encoder, email);
    }

    @Test void unknownAccountDoesNotSendMail() {
        when(users.findForUpdateByEmail("missing@example.test")).thenReturn(Optional.empty());
        recovery.deliverRequest("missing@example.test");
        verifyNoInteractions(resets, email);
    }

    @Test void deliveryStoresOnlyHashAndSendsARealExpiringLink() throws Exception {
        when(users.findForUpdateByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(resets.findForUpdate(user.getId())).thenReturn(Optional.empty());
        when(email.sendHtmlEmail(anyString(), anyString(), anyString(), anyMap())).thenReturn(true);
        recovery.deliverRequest(user.getEmail());
        ArgumentCaptor<PasswordReset> persisted = ArgumentCaptor.forClass(PasswordReset.class);
        verify(resets).save(persisted.capture());
        ArgumentCaptor<Map<String,Object>> variables = ArgumentCaptor.forClass(Map.class);
        verify(email).sendHtmlEmail(eq(user.getEmail()), anyString(), eq("email/password-reset"), variables.capture());
        String link = (String) variables.getValue().get("actionUrl");
        assertTrue(link.startsWith("https://quesale.test/reset-password?token="));
        String token = link.substring(link.indexOf("token=") + 6);
        assertEquals(43, token.length());
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        assertEquals(hash, persisted.getValue().getTokenHash());
        assertNotEquals(token, persisted.getValue().getTokenHash());
        assertTrue(persisted.getValue().getExpiresAt().isAfter(Instant.now().plusSeconds(1100)));
        assertNull(persisted.getValue().getUsedAt());
    }

    @Test void confirmationRevokesEverySessionAndCannotBeReused() throws Exception {
        String token = "a".repeat(43);
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        PasswordReset reset = new PasswordReset(); reset.setUser(user); reset.setTokenHash(hash);
        reset.setExpiresAt(Instant.now().plusSeconds(600));
        when(resets.findUserIdByTokenHash(hash)).thenReturn(Optional.of(user.getId()));
        when(users.findForUpdateById(user.getId())).thenReturn(Optional.of(user));
        when(resets.findForUpdate(user.getId())).thenReturn(Optional.of(reset));
        when(encoder.encode("Different2026")).thenReturn("new-hash");
        recovery.confirm(token, "Different2026");
        assertEquals("new-hash", user.getPassword());
        assertNotNull(reset.getUsedAt());
        verify(sessions).revokeForUser(eq(user.getId()), any(Instant.class));
        verify(queue).enqueue(eq("EMAIL"), any(JobPayload.class));
        assertThrows(InvalidOperationException.class, () -> recovery.confirm(token,"Different2026"));
        verify(encoder, times(1)).encode(anyString());
    }

    @Test void expiredLinkDoesNotChangePasswordOrSessions() throws Exception {
        String token="b".repeat(43);
        String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        PasswordReset reset=new PasswordReset();reset.setTokenHash(hash);reset.setExpiresAt(Instant.now().minusSeconds(1));
        when(resets.findUserIdByTokenHash(hash)).thenReturn(Optional.of(user.getId()));
        when(users.findForUpdateById(user.getId())).thenReturn(Optional.of(user));
        when(resets.findForUpdate(user.getId())).thenReturn(Optional.of(reset));
        assertThrows(InvalidOperationException.class,()->recovery.confirm(token,"Different2026"));
        verifyNoInteractions(encoder,sessions,queue);
    }
}
