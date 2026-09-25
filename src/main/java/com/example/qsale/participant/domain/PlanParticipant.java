package com.example.qsale.participant.domain;

import com.example.qsale.plan.domain.Plan;
import com.example.qsale.user.domain.User;
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
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "plan_participants",
        uniqueConstraints = @UniqueConstraint(columnNames = {"plan_id", "user_id"}),
        indexes = @Index(columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class PlanParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private Plan plan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ParticipantRole role = ParticipantRole.GUEST;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ParticipationStatus status = ParticipationStatus.INVITED;

    @Column(nullable = false)
    private LocalDateTime invitedAt = LocalDateTime.now();

    private LocalDateTime joinedAt;

    public PlanParticipant(Plan plan, User user, ParticipantRole role) {
        this.plan = plan;
        this.user = user;
        this.role = role;
    }

    public boolean isOrganizer() {
        return role == ParticipantRole.ORGANIZER;
    }
}
