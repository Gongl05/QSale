package com.example.qsale.availability.domain;

import com.example.qsale.plan.domain.Plan;
import com.example.qsale.user.domain.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "availabilities", indexes = @Index(columnList = "plan_id, available_date"))
@Getter
@Setter
@NoArgsConstructor
public class Availability {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private Plan plan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private User user;

    @Column(nullable = false)
    private LocalDate availableDate;

    private LocalTime startTime;

    private LocalTime endTime;

    public Availability(Plan plan, User user, LocalDate availableDate, LocalTime startTime, LocalTime endTime) {
        this.plan = plan;
        this.user = user;
        this.availableDate = availableDate;
        this.startTime = startTime;
        this.endTime = endTime;
    }
}
