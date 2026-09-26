package com.example.qsale.plan.domain;

import com.example.qsale.availability.domain.Availability;
import com.example.qsale.commitment.domain.CommitmentResponse;
import com.example.qsale.notification.domain.Notification;
import com.example.qsale.option.domain.PlanOption;
import com.example.qsale.participant.domain.PlanParticipant;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "plans", indexes = {
        @Index(columnList = "creator_id"),
        @Index(columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
public class Plan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PlanType type;

    private Double budget;

    @Column(nullable = false)
    private Integer minParticipants;

    private LocalDate tentativeStartDate;

    private LocalDate tentativeEndDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PlanStatus status = PlanStatus.OPEN;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FeasibilityStatus feasibilityStatus = FeasibilityStatus.NOT_VIABLE;

    @Column(nullable = false)
    private Integer feasibilityScore = 0;

    @Column(nullable = false, unique = true, length = 12)
    private String inviteCode;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime closedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private User creator;

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PlanParticipant> participants = new ArrayList<>();

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PlanOption> options = new ArrayList<>();

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Availability> availabilities = new ArrayList<>();

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CommitmentResponse> commitments = new ArrayList<>();

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Notification> notifications = new ArrayList<>();

    public void addParticipant(PlanParticipant participant) {
        participants.add(participant);
        participant.setPlan(this);
    }

    public void addOption(PlanOption option) {
        options.add(option);
        option.setPlan(this);
    }

    public boolean isOpen() {
        return status == PlanStatus.OPEN;
    }
}
