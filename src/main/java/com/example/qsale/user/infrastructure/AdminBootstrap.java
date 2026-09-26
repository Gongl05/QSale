package com.example.qsale.user.infrastructure;

import com.example.qsale.user.domain.Role;
import com.example.qsale.user.domain.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;

@Component
@ConditionalOnProperty(name = "admin.bootstrap.enabled", havingValue = "true")
public class AdminBootstrap implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String password;

    public AdminBootstrap(UserRepository userRepository, PasswordEncoder passwordEncoder,
                          @Value("${ADMIN_BOOTSTRAP_EMAIL:}") String email,
                          @Value("${ADMIN_BOOTSTRAP_PASSWORD:}") String password) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.email = email;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (email == null || email.isBlank() || password == null || password.length() < 12) {
            throw new IllegalStateException("Admin bootstrap requires an email and a password of at least 12 characters");
        }

        String normalizedEmail = email.strip().toLowerCase(Locale.ROOT);
        Optional<User> existing = userRepository.findByEmail(normalizedEmail);
        if (existing.isPresent() && existing.get().getRole() != Role.ADMIN) {
            throw new IllegalStateException("Admin bootstrap cannot promote an existing user");
        }

        User admin = existing.orElseGet(() -> new User("QSale Admin", normalizedEmail, "", Role.ADMIN));
        admin.setPassword(passwordEncoder.encode(password));
        userRepository.save(admin);
    }
}
