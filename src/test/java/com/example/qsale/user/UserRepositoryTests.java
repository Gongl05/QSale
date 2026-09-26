package com.example.qsale.user;

import com.example.qsale.AbstractContainerBaseTest;
import com.example.qsale.user.domain.Role;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.infrastructure.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest
public class UserRepositoryTests extends AbstractContainerBaseTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    void shouldSaveUserAndFindItByEmail() {
        User user = new User("Ana Torres", "ana.repo@utec.edu.pe", "hashed-password", Role.USER);

        userRepository.save(user);
        Optional<User> found = userRepository.findByEmail("ana.repo@utec.edu.pe");

        assertTrue(found.isPresent());
        assertNotNull(found.get().getId());
        assertEquals("Ana Torres", found.get().getName());
        assertEquals(Role.USER, found.get().getRole());
        assertNotNull(found.get().getCreatedAt());
    }

    @Test
    void shouldReportWhetherEmailExists() {
        userRepository.save(new User("Bob Diaz", "bob.repo@utec.edu.pe", "hashed-password", Role.USER));

        boolean existing = userRepository.existsByEmail("bob.repo@utec.edu.pe");
        boolean missing = userRepository.existsByEmail("nobody@utec.edu.pe");

        assertTrue(existing);
        assertFalse(missing);
    }

    @Test
    void shouldRejectDuplicatedEmail() {
        userRepository.saveAndFlush(new User("Carla", "carla.repo@utec.edu.pe", "hashed-password", Role.USER));
        User duplicated = new User("Carla Bis", "carla.repo@utec.edu.pe", "other-password", Role.USER);

        assertThrows(DataIntegrityViolationException.class, () -> userRepository.saveAndFlush(duplicated));
    }
}
