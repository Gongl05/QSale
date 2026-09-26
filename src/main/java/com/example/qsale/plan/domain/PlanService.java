package com.example.qsale.plan.domain;

import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.option.domain.PlanOptionService;
import com.example.qsale.participant.domain.ParticipantRole;
import com.example.qsale.participant.domain.ParticipationStatus;
import com.example.qsale.participant.domain.PlanParticipant;
import com.example.qsale.plan.dto.PlanDetailDto;
import com.example.qsale.plan.dto.PlanPageResponseDto;
import com.example.qsale.plan.dto.PlanRequestDto;
import com.example.qsale.plan.dto.PlanResponseDto;
import com.example.qsale.plan.events.PlanChangedEvent;
import com.example.qsale.plan.events.PlanStatusChangedEvent;
import com.example.qsale.plan.events.PlanUpdatedEvent;
import com.example.qsale.plan.infrastructure.PlanRepository;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PlanService {

    private static final int MAX_PAGE_SIZE = 50;

    private final PlanRepository planRepository;
    private final PlanAccessService planAccessService;
    private final FeasibilityService feasibilityService;
    private final PlanOptionService planOptionService;
    private final UserService userService;
    private final ModelMapper modelMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public PlanDetailDto createPlan(PlanRequestDto dto) {
        validateDates(dto);
        User user = userService.getCurrentUser();

        Plan plan = modelMapper.map(dto, Plan.class);
        plan.setCreator(user);
        plan.setInviteCode(generateInviteCode());
        plan.addParticipant(createOrganizer(plan, user));
        return modelMapper.map(planRepository.save(plan), PlanDetailDto.class);
    }

    public PlanPageResponseDto getMyPlans(PlanStatus status, int page, int size) {
        validatePagination(page, size);
        User user = userService.getCurrentUser();
        Pageable pageable = PageRequest.of(page, Math.min(size, MAX_PAGE_SIZE), Sort.by("createdAt").descending());
        Page<Plan> plans = status == null
                ? planRepository.findByParticipantsUserId(user.getId(), pageable)
                : planRepository.findByParticipantsUserIdAndStatus(user.getId(), status, pageable);
        return new PlanPageResponseDto(
                plans.map(plan -> modelMapper.map(plan, PlanResponseDto.class)).getContent(),
                plans.getNumber(), plans.getSize(), plans.getTotalElements(), plans.getTotalPages());
    }

    public PlanDetailDto getPlan(Long planId) {
        Plan plan = planAccessService.getPlanAsMember(planId, userService.getCurrentUser());
        return modelMapper.map(plan, PlanDetailDto.class);
    }

    @Transactional
    public PlanDetailDto updatePlan(Long planId, PlanRequestDto dto) {
        validateDates(dto);
        Plan plan = planAccessService.getPlanAsOrganizer(planId, userService.getCurrentUser());
        planAccessService.requireOpen(plan);
        modelMapper.map(dto, plan);
        PlanDetailDto response = modelMapper.map(planRepository.save(plan), PlanDetailDto.class);
        eventPublisher.publishEvent(new PlanChangedEvent(this, planId));
        eventPublisher.publishEvent(new PlanUpdatedEvent(this, planId));
        return response;
    }

    @Transactional
    public PlanDetailDto closePlan(Long planId) {
        Plan plan = planAccessService.getPlanAsOrganizer(planId, userService.getCurrentUser());
        planAccessService.requireOpen(plan);
        feasibilityService.updateFeasibility(plan);
        if (plan.getFeasibilityStatus() != FeasibilityStatus.READY_TO_CLOSE) {
            throw new InvalidOperationException("Plan " + planId + " is not ready to close yet (status "
                    + plan.getFeasibilityStatus() + ", score " + plan.getFeasibilityScore() + ")");
        }
        planOptionService.selectBestOptions(plan);
        return changeStatus(plan, PlanStatus.CLOSED);
    }

    @Transactional
    public PlanDetailDto cancelPlan(Long planId) {
        Plan plan = planAccessService.getPlanAsOrganizer(planId, userService.getCurrentUser());
        planAccessService.requireOpen(plan);
        return changeStatus(plan, PlanStatus.CANCELLED);
    }

    @Transactional
    public void deletePlan(Long planId) {
        Plan plan = planAccessService.getPlanAsOrganizer(planId, userService.getCurrentUser());
        planRepository.delete(plan);
    }

    private PlanDetailDto changeStatus(Plan plan, PlanStatus status) {
        plan.setStatus(status);
        plan.setClosedAt(LocalDateTime.now());
        PlanDetailDto response = modelMapper.map(planRepository.save(plan), PlanDetailDto.class);
        eventPublisher.publishEvent(new PlanStatusChangedEvent(this, plan.getId()));
        return response;
    }

    private PlanParticipant createOrganizer(Plan plan, User user) {
        PlanParticipant organizer = new PlanParticipant(plan, user, ParticipantRole.ORGANIZER);
        organizer.setStatus(ParticipationStatus.JOINED);
        organizer.setJoinedAt(LocalDateTime.now());
        return organizer;
    }

    private String generateInviteCode() {
        String code;
        do {
            code = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        } while (planRepository.existsByInviteCode(code));
        return code;
    }

    private void validatePagination(int page, int size) {
        if (page < 0) {
            throw new InvalidOperationException("page must be greater than or equal to 0");
        }
        if (size < 1) {
            throw new InvalidOperationException("size must be greater than or equal to 1");
        }
    }

    private void validateDates(PlanRequestDto dto) {
        if (dto.getTentativeStartDate() != null && dto.getTentativeEndDate() != null
                && dto.getTentativeEndDate().isBefore(dto.getTentativeStartDate())) {
            throw new InvalidOperationException("tentativeEndDate must be on or after tentativeStartDate");
        }
    }
}
