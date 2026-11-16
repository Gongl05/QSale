package com.example.qsale.auth.domain;

import com.example.qsale.user.domain.User;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "password_resets")
@Getter @Setter @NoArgsConstructor
public class PasswordReset {
    @Id private Long userId;
    @MapsId @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id") private User user;
    @Column(nullable = false, unique = true, length = 64) private String tokenHash;
    @Column(nullable = false) private Instant issuedAt;
    @Column(nullable = false) private Instant expiresAt;
    private Instant usedAt;
    @Column(nullable = false) private Instant windowStartedAt;
    @Column(nullable = false) private int requestsInWindow;
}
