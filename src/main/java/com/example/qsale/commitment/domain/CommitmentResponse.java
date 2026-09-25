package com.example.qsale.commitment.domain;

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
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "commitment_responses", uniqueConstraints = @UniqueConstraint(columnNames = {"plan_id", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
public class CommitmentResponse {

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
    private CommitmentStatus status;

    private String note;

    @Column(nullable = false)
    private LocalDateTime respondedAt = LocalDateTime.now();

    public CommitmentResponse(Plan plan, User user, CommitmentStatus status) {
        this.plan = plan;
        this.user = user;
        this.status = status;
    }
}
