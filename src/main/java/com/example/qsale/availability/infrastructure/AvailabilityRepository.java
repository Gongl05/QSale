package com.example.qsale.availability.infrastructure;

import com.example.qsale.availability.domain.Availability;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AvailabilityRepository extends JpaRepository<Availability, Long> {

    List<Availability> findByPlanId(Long planId);

    List<Availability> findByPlanIdAndUserId(Long planId, Long userId);

    long deleteByPlanIdAndUserId(Long planId, Long userId);
}
