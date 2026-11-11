package com.example.qsale.plan.domain;

import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.participant.domain.ParticipationStatus;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.infrastructure.PlanRepository;
import com.example.qsale.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component("planAuthorization")
@RequiredArgsConstructor
public class PlanAuthorization {

    private final PlanParticipantRepository participantRepository;
    private final PlanOptionRepository optionRepository;
    private final PlanRepository planRepository;

    // Missing resources proceed to the service, which preserves the API's 404 response.

    public boolean isMember(Long planId, Authentication authentication) {
        User user = authenticatedUser(authentication);
        return user != null && (user.isAdmin() || !planRepository.existsById(planId)
                || participantRepository.existsByPlanIdAndUserId(planId, user.getId()));
    }

    public boolean isJoined(Long planId, Authentication authentication) {
        User user = authenticatedUser(authentication);
        return user != null && (!planRepository.existsById(planId)
                || participantRepository.findByPlanIdAndUserId(planId, user.getId())
                .map(participant -> participant.getStatus() == ParticipationStatus.JOINED)
                .orElse(false));
    }

    public boolean isOrganizer(Long planId, Authentication authentication) {
        User user = authenticatedUser(authentication);
        return user != null && (user.isAdmin() || !planRepository.existsById(planId)
                || participantRepository.findByPlanIdAndUserId(planId, user.getId())
                .map(participant -> participant.isOrganizer()
                        && participant.getStatus() == ParticipationStatus.JOINED)
                .orElse(false));
    }

    public boolean canRemoveParticipant(Long planId, Long userId, Authentication authentication) {
        User user = authenticatedUser(authentication);
        return user != null && (isOrganizer(planId, authentication)
                || (user.getId().equals(userId) && isMember(planId, authentication)));
    }

    public boolean canVote(Long optionId, Authentication authentication) {
        if (authenticatedUser(authentication) == null) return false;
        return optionRepository.findById(optionId)
                .map(option -> isJoined(option.getPlan().getId(), authentication))
                .orElse(true); // The service returns 404 for an option that does not exist.
    }

    private User authenticatedUser(Authentication authentication) {
        return authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof User user ? user : null;
    }
}
