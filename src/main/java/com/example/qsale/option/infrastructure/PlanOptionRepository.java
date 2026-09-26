package com.example.qsale.option.infrastructure;

import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.domain.PlanOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlanOptionRepository extends JpaRepository<PlanOption, Long> {

    List<PlanOption> findByPlanId(Long planId);

    List<PlanOption> findByPlanIdAndType(Long planId, OptionType type);

    Optional<PlanOption> findByIdAndPlanId(Long id, Long planId);
}
