package com.example.qsale.option.domain;

import com.example.qsale.location.domain.Location;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.user.domain.User;
import com.example.qsale.vote.domain.Vote;
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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "plan_options", indexes = @Index(columnList = "plan_id"))
@Getter
@Setter
@NoArgsConstructor
public class PlanOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private Plan plan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private User proposedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OptionType type;

    @Column(nullable = false, length = 120)
    private String label;

    @Column(length = 500)
    private String description;

    private LocalDateTime startsAt;

    private LocalDateTime endsAt;

    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private Location location;

    private Double avgDistanceKm;

    private Integer avgTravelMinutes;

    @Column(nullable = false)
    private boolean selected = false;

    @OneToMany(mappedBy = "option", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Vote> votes = new ArrayList<>();
}
