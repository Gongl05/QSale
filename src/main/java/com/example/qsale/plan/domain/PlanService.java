package com.example.qsale.plan.domain;

import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.exceptions.ConflictException;
import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.domain.PlanOption;
import com.example.qsale.option.domain.PlanOptionService;
import com.example.qsale.participant.domain.ParticipantRole;
import com.example.qsale.participant.domain.ParticipationStatus;
import com.example.qsale.participant.domain.PlanParticipant;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.dto.PlanDetailDto;
import com.example.qsale.plan.dto.PlanMemberDto;
import com.example.qsale.plan.dto.PlanPageResponseDto;
import com.example.qsale.plan.dto.PlanRequestDto;
import com.example.qsale.plan.dto.PlanResponseDto;
import com.example.qsale.plan.events.PlanChangedEvent;
import com.example.qsale.plan.events.PlanStatusChangedEvent;
import com.example.qsale.plan.events.PlanUpdatedEvent;
import com.example.qsale.plan.infrastructure.PlanRepository;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import com.example.qsale.commitment.domain.CommitmentStatus;
import com.example.qsale.commitment.infrastructure.CommitmentResponseRepository;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlanService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> SORT_FIELDS = Set.of("createdAt", "name", "tentativeStartDate",
            "feasibilityScore", "budget");

    private final PlanRepository planRepository;
    private final PlanParticipantRepository participantRepository;
    private final PlanAccessService planAccessService;
    private final FeasibilityService feasibilityService;
    private final PlanOptionService planOptionService;
    private final UserService userService;
    private final ModelMapper modelMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final CommitmentResponseRepository commitments;

    @PreAuthorize("isAuthenticated()")
    @Transactional
    public PlanDetailDto createPlan(PlanRequestDto dto) {
        validateDates(dto);
        User user = userService.getCurrentUser();

        Plan plan = modelMapper.map(dto, Plan.class);
        plan.setTentativeDates(tentativeDays(dto));
        plan.setVersion(null);
        plan.setCreator(user);
        plan.setInviteCode(generateInviteCode());
        plan.addParticipant(createOrganizer(plan, user));
        return toDetail(planRepository.save(plan), user.getId());
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public PlanPageResponseDto getMyPlans(PlanStatus status, int page, int size, String search, String sort) {
        validatePagination(page, size);
        String term = search == null ? "" : search.strip();
        if (term.length() > 200) {
            throw new InvalidOperationException("search must not exceed 200 characters");
        }
        Sort ordering = parseSort(sort);
        User user = userService.getCurrentUser();
        Pageable pageable = PageRequest.of(page, Math.min(size, MAX_PAGE_SIZE), ordering);
        Page<Plan> plans = planRepository.searchMyPlans(user.getId(), status, term, pageable);
        List<Long> planIds = plans.getContent().stream().map(Plan::getId).toList();
        Map<Long, PlanParticipant> memberships = planIds.isEmpty() ? Map.of()
                : participantRepository.findByUserIdAndPlanIdIn(user.getId(), planIds).stream()
                .collect(Collectors.toMap(participant -> participant.getPlan().getId(), Function.identity()));
        return new PlanPageResponseDto(
                plans.map(plan -> withAgreement(withMembership(modelMapper.map(plan, PlanResponseDto.class),
                        memberships.get(plan.getId())), plan)).getContent(),
                plans.getNumber(), plans.getSize(), plans.getTotalElements(), plans.getTotalPages());
    }

    @PreAuthorize("@planAuthorization.isMember(#planId, authentication)")
    @Transactional(readOnly = true)
    public PlanDetailDto getPlan(Long planId) {
        User user = userService.getCurrentUser();
        Plan plan = planAccessService.getPlanAsMember(planId, user);
        return toDetail(plan, user.getId());
    }

    @PreAuthorize("@planAuthorization.isOrganizer(#planId, authentication)")
    @Transactional
    public PlanDetailDto updatePlan(Long planId, PlanRequestDto dto) {
        validateDates(dto);
        Plan plan = planAccessService.lockAsOrganizer(planId, userService.getCurrentUser());
        planAccessService.requireOpen(plan);
        if (dto.getVersion() == null || !dto.getVersion().equals(plan.getVersion())) {
            throw new ConflictException("The plan changed. Reload its latest version before saving your draft");
        }
        List<LocalDate> days = updatedTentativeDays(dto, plan);
        modelMapper.map(dto, plan);
        plan.setTentativeDates(days);
        PlanDetailDto response = toDetail(planRepository.saveAndFlush(plan), userService.getCurrentUser().getId());
        eventPublisher.publishEvent(new PlanChangedEvent(this, planId));
        eventPublisher.publishEvent(new PlanUpdatedEvent(this, planId));
        return response;
    }

    @PreAuthorize("@planAuthorization.isOrganizer(#planId, authentication)")
    @Transactional
    public PlanDetailDto closePlan(Long planId) {
        Plan plan = planAccessService.lockAsOrganizer(planId, userService.getCurrentUser());
        planAccessService.requireOpen(plan);
        feasibilityService.updateFeasibility(plan);
        if (plan.getFeasibilityStatus() != FeasibilityStatus.READY_TO_CLOSE) {
            throw new InvalidOperationException("Plan " + planId + " is not ready to close yet (status "
                    + plan.getFeasibilityStatus() + ", score " + plan.getFeasibilityScore() + ")");
        }
        planOptionService.selectBestOptions(plan);
        plan.setAgreementVersion(plan.getAgreementVersion() + 1);
        return changeStatus(plan, PlanStatus.CLOSED);
    }

    @PreAuthorize("@planAuthorization.isOrganizer(#planId, authentication)")
    @Transactional
    public PlanDetailDto cancelPlan(Long planId) {
        Plan plan = planAccessService.lockAsOrganizer(planId, userService.getCurrentUser());
        planAccessService.requireNotCancelled(plan);
        return changeStatus(plan, PlanStatus.CANCELLED);
    }

    @PreAuthorize("@planAuthorization.isOrganizer(#planId, authentication)")
    @Transactional
    public PlanDetailDto reopenPlan(Long planId) {
        Plan plan = planAccessService.lockAsOrganizer(planId, userService.getCurrentUser());
        if (plan.getStatus() != PlanStatus.CLOSED) throw new InvalidOperationException("Only a confirmed plan can be reopened");
        plan.setStatus(PlanStatus.OPEN); plan.setClosedAt(null);
        plan.setAgreementVersion(plan.getAgreementVersion() + 1);
        plan.getOptions().forEach(option -> option.setSelected(false));
        commitments.findByPlanId(planId).forEach(response -> {
            if (response.getStatus() == CommitmentStatus.CONFIRMED) response.setStatus(CommitmentStatus.INTERESTED);
        });
        feasibilityService.updateFeasibility(plan);
        eventPublisher.publishEvent(new PlanStatusChangedEvent(this, planId));
        return toDetail(plan, userService.getCurrentUser().getId());
    }

    @PreAuthorize("@planAuthorization.isOrganizer(#planId, authentication)")
    @Transactional
    public void deletePlan(Long planId) {
        Plan plan = planAccessService.lockAsOrganizer(planId, userService.getCurrentUser());
        planRepository.delete(plan);
    }

    private PlanDetailDto changeStatus(Plan plan, PlanStatus status) {
        plan.setStatus(status);
        plan.setClosedAt(LocalDateTime.now());
        PlanDetailDto response = toDetail(planRepository.save(plan), userService.getCurrentUser().getId());
        eventPublisher.publishEvent(new PlanStatusChangedEvent(this, plan.getId()));
        return response;
    }

    private PlanParticipant createOrganizer(Plan plan, User user) {
        PlanParticipant organizer = new PlanParticipant(plan, user, ParticipantRole.ORGANIZER);
        organizer.setStatus(ParticipationStatus.JOINED);
        organizer.setJoinedAt(LocalDateTime.now());
        return organizer;
    }

    private PlanDetailDto toDetail(Plan plan, Long userId) {
        PlanParticipant membership = plan.getParticipants().stream()
                .filter(participant -> participant.getUser().getId().equals(userId))
                .findFirst().orElse(null);
        return withAgreement(withMembership(modelMapper.map(plan, PlanDetailDto.class), membership), plan);
    }

    private <T extends PlanResponseDto> T withMembership(T response, PlanParticipant membership) {
        response.setCurrentUserRole(membership == null ? null : membership.getRole());
        response.setCurrentUserParticipationStatus(membership == null ? null : membership.getStatus());
        response.setCurrentUserOriginAddressId(membership == null || membership.getOriginAddress() == null
                ? null : membership.getOriginAddress().getId());
        return response;
    }

    /** Copies the chosen day and place, so lists and calendars can show them without loading the options. */
    private <T extends PlanResponseDto> T withAgreement(T response, Plan plan) {
        List<PlanParticipant> joined = plan.getParticipants().stream()
                .filter(participant -> participant.getStatus() == ParticipationStatus.JOINED)
                .toList();
        response.setJoinedCount(joined.size());
        response.setMembers(joined.stream()
                .limit(5)
                .map(participant -> new PlanMemberDto(participant.getUser().getId(), participant.getUser().getName(),
                        participant.getUser().getNickname(), participant.getUser().getAvatarVersion()))
                .toList());
        for (PlanOption option : plan.getOptions()) {
            if (!option.isSelected()) {
                continue;
            }
            if (option.getType() == OptionType.DATE) {
                response.setAgreedStartsAt(option.getStartsAt());
                response.setAgreedEndsAt(option.getEndsAt());
                response.setAgreedStartsOn(option.getStartsOn());
                response.setAgreedEndsOn(option.getEndsOn());
            } else if (option.getType() == OptionType.PLACE) {
                response.setAgreedPlace(option.getLabel());
                response.setAgreedAddress(option.getLocation() == null ? null : option.getLocation().getAddress());
            }
        }
        return response;
    }

    /**
     * Clients that do not send tentativeDates (like older versions of the web app) keep the plan's
     * days, unless they set a date range, which replaces them.
     */
    private List<LocalDate> updatedTentativeDays(PlanRequestDto dto, Plan plan) {
        if (dto.getTentativeDates() != null) {
            return tentativeDays(dto);
        }
        boolean hasRange = dto.getTentativeStartDate() != null || dto.getTentativeEndDate() != null;
        return hasRange ? new ArrayList<>() : new ArrayList<>(plan.getTentativeDates());
    }

    private List<LocalDate> tentativeDays(PlanRequestDto dto) {
        if (dto.getTentativeDates() == null) {
            return new ArrayList<>();
        }
        return dto.getTentativeDates().stream().distinct().sorted()
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private Sort parseSort(String sort) {
        String[] parts = (sort == null ? "createdAt,desc" : sort).split(",", -1);
        if (parts.length != 2 || !SORT_FIELDS.contains(parts[0])
                || !("asc".equalsIgnoreCase(parts[1]) || "desc".equalsIgnoreCase(parts[1]))) {
            throw new InvalidOperationException("sort must use an allowed field and asc or desc");
        }
        Sort.Direction direction = Sort.Direction.fromString(parts[1]);
        return Sort.by(direction, parts[0]).and(Sort.by(direction, "id"));
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
        boolean hasDays = dto.getTentativeDates() != null && !dto.getTentativeDates().isEmpty();
        if (hasDays && (dto.getTentativeStartDate() != null || dto.getTentativeEndDate() != null)) {
            throw new InvalidOperationException("Send either a tentative date range or specific tentative days, not both");
        }
    }
}
