package com.example.qsale.option.infrastructure;

import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.domain.PlanOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlanOptionRepository extends JpaRepository<PlanOption, Long> {

    List<PlanOption> findByPlanId(Long planId);

    List<PlanOption> findByPlanIdAndType(Long planId, OptionType type);
}
