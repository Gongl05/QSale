package com.example.qsale.address.domain;

import com.example.qsale.location.domain.Location;
import com.example.qsale.user.domain.User;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * A place the user usually starts from, such as home or the office. The main address is the
 * default starting point for travel estimates; a participant can pick another one per plan.
 */
@Entity
@Table(name = "saved_addresses", indexes = @Index(columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class SavedAddress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private User user;

    @Column(nullable = false, length = 40)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AddressType type;

    @Column(nullable = false)
    private boolean favorite;

    @Column(nullable = false)
    private boolean main;

    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JoinColumn(nullable = false, unique = true)
    private Location location;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public SavedAddress(User user, String label, AddressType type, Location location) {
        this.user = user;
        this.label = label;
        this.type = type;
        this.location = location;
    }
}
