package com.example.qsale.option.domain;

import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.exceptions.ResourceNotFoundException;
import com.example.qsale.option.dto.OptionRequestDto;
import com.example.qsale.option.dto.OptionResponseDto;
import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.domain.FeasibilityService;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.plan.domain.PlanAccessService;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import com.example.qsale.vote.infrastructure.VoteRepository;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PlanOptionService {

    private final PlanOptionRepository optionRepository;
    private final PlanParticipantRepository participantRepository;
    private final VoteRepository voteRepository;
    private final PlanAccessService planAccessService;
    private final FeasibilityService feasibilityService;
    private final UserService userService;
    private final ModelMapper modelMapper;

    @Transactional
    public OptionResponseDto createOption(Long planId, OptionRequestDto dto) {
        User user = userService.getCurrentUser();
        Plan plan = planAccessService.getPlanAsMember(planId, user);
        planAccessService.requireOpen(plan);
        validateOption(dto);

        PlanOption option = modelMapper.map(dto, PlanOption.class);
        option.setProposedBy(user);
        plan.addOption(option);
        return toResponse(optionRepository.save(option), participantRepository.countByPlanId(planId));
    }

    public List<OptionResponseDto> getOptions(Long planId, OptionType type) {
        planAccessService.getPlanAsMember(planId, userService.getCurrentUser());
        List<PlanOption> options = type == null
                ? optionRepository.findByPlanId(planId)
                : optionRepository.findByPlanIdAndType(planId, type);
        long participants = participantRepository.countByPlanId(planId);
        return options.stream()
                .map(option -> toResponse(option, participants))
                .sorted(Comparator.comparingInt(OptionResponseDto::getScore).reversed())
                .toList();
    }

    @Transactional
    public void deleteOption(Long planId, Long optionId) {
        Plan plan = planAccessService.getPlanAsOrganizer(planId, userService.getCurrentUser());
        planAccessService.requireOpen(plan);
        PlanOption option = optionRepository.findByIdAndPlanId(optionId, planId)
                .orElseThrow(() -> new ResourceNotFoundException("Option " + optionId + " not found in plan " + planId));
        plan.getOptions().remove(option);
        feasibilityService.updateFeasibility(plan);
    }

    public PlanOption getOption(Long optionId) {
        return optionRepository.findById(optionId)
                .orElseThrow(() -> new ResourceNotFoundException("Option not found with id " + optionId));
    }

    @Transactional
    public void selectBestOptions(Plan plan) {
        for (OptionType type : OptionType.values()) {
            optionRepository.findByPlanIdAndType(plan.getId(), type).stream()
                    .filter(option -> voteRepository.countByOptionId(option.getId()) > 0)
                    .max(Comparator.comparingLong(option -> voteRepository.countByOptionId(option.getId())))
                    .ifPresent(option -> option.setSelected(true));
        }
    }

    private void validateOption(OptionRequestDto dto) {
        if (dto.getType() == OptionType.DATE && dto.getStartsAt() == null) {
            throw new InvalidOperationException("A DATE option requires startsAt");
        }
        if (dto.getType() == OptionType.PLACE && dto.getLocation() == null) {
            throw new InvalidOperationException("A PLACE option requires a location");
        }
        if (dto.getStartsAt() != null && dto.getEndsAt() != null && dto.getEndsAt().isBefore(dto.getStartsAt())) {
            throw new InvalidOperationException("endsAt must be after startsAt");
        }
    }

    private OptionResponseDto toResponse(PlanOption option, long participants) {
        OptionResponseDto response = modelMapper.map(option, OptionResponseDto.class);
        long votes = voteRepository.countByOptionId(option.getId());
        response.setVoteCount(votes);
        response.setScore(feasibilityService.calculateOptionScore(option, votes, participants));
        return response;
    }
}
