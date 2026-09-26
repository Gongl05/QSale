package com.example.qsale.user;

import com.example.qsale.user.domain.Role;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.infrastructure.AdminBootstrap;
import com.example.qsale.user.infrastructure.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminBootstrapTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withBean(UserRepository.class, () -> mock(UserRepository.class))
            .withBean(PasswordEncoder.class, () -> mock(PasswordEncoder.class))
            .withUserConfiguration(AdminBootstrap.class);

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    void bootstrapIsDisabledByDefault() {
        contextRunner.run(context -> assertEquals(0, context.getBeansOfType(AdminBootstrap.class).size()));
    }

    @Test
    void bootstrapRequiresExplicitEnablement() {
        contextRunner.withPropertyValues("admin.bootstrap.enabled=true")
                .run(context -> assertEquals(1, context.getBeansOfType(AdminBootstrap.class).size()));
    }

    @Test
    void createsAdminOnlyWithExplicitCredentials() throws Exception {
        AdminBootstrap bootstrap = new AdminBootstrap(userRepository, passwordEncoder,
                " Admin@Example.com ", "StrongAdminPassword123");
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("StrongAdminPassword123")).thenReturn("encoded-password");

        bootstrap.run(null);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertEquals("admin@example.com", saved.getValue().getEmail());
        assertEquals(Role.ADMIN, saved.getValue().getRole());
        assertEquals("encoded-password", saved.getValue().getPassword());
    }

    @Test
    void rotatesPasswordOfAnExistingAdmin() throws Exception {
        User admin = new User("Admin", "admin@example.com", "old-hash", Role.ADMIN);
        AdminBootstrap bootstrap = new AdminBootstrap(userRepository, passwordEncoder,
                "admin@example.com", "NewStrongPassword123");
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));
        when(passwordEncoder.encode("NewStrongPassword123")).thenReturn("new-hash");

        bootstrap.run(null);

        assertEquals("new-hash", admin.getPassword());
        verify(userRepository).save(admin);
    }

    @Test
    void neverPromotesAnExistingUser() {
        User user = new User("User", "user@example.com", "user-hash", Role.USER);
        AdminBootstrap bootstrap = new AdminBootstrap(userRepository, passwordEncoder,
                "user@example.com", "StrongAdminPassword123");
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));

        assertThrows(IllegalStateException.class, () -> bootstrap.run(null));

        verify(userRepository, never()).save(user);
        verify(passwordEncoder, never()).encode("StrongAdminPassword123");
    }

    @Test
    void rejectsMissingOrWeakCredentials() {
        AdminBootstrap missingEmail = new AdminBootstrap(userRepository, passwordEncoder,
                "", "StrongAdminPassword123");
        AdminBootstrap weakPassword = new AdminBootstrap(userRepository, passwordEncoder,
                "admin@example.com", "weak");

        assertThrows(IllegalStateException.class, () -> missingEmail.run(null));
        assertThrows(IllegalStateException.class, () -> weakPassword.run(null));
    }
}
