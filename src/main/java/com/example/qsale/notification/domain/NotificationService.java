package com.example.qsale.notification.domain;

import com.example.qsale.exceptions.ResourceNotFoundException;
import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.jobs.BackgroundQueue;
import com.example.qsale.jobs.JobPayload;
import com.example.qsale.notification.dto.NotificationPageResponseDto;
import com.example.qsale.notification.dto.NotificationResponseDto;
import com.example.qsale.notification.infrastructure.NotificationRepository;
import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.domain.PlanOption;
import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.participant.domain.PlanParticipant;
import com.example.qsale.participant.domain.ParticipationStatus;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.plan.domain.PlanAccessService;
import com.example.qsale.plan.domain.PlanStatus;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final PlanParticipantRepository participantRepository;
    private final PlanOptionRepository optionRepository;
    private final PlanAccessService planAccessService;
    private final BackgroundQueue queue;
    private final UserService userService;
    private final ModelMapper modelMapper;
    private final PublicLinks links;

    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public List<NotificationResponseDto> getMyNotifications(boolean unreadOnly) {
        Long userId = userService.getCurrentUser().getId();
        List<Notification> notifications = unreadOnly
                ? notificationRepository.findByRecipientIdAndReadAtIsNullOrderByCreatedAtDesc(userId)
                : notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId);
        return notifications.stream()
                .map(notification -> modelMapper.map(notification, NotificationResponseDto.class))
                .toList();
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public NotificationPageResponseDto getMyNotificationsPage(boolean unreadOnly, int page, int size) {
        if (page < 0 || size < 1) {
            throw new InvalidOperationException("page must be non-negative and size must be positive");
        }
        Long userId = userService.getCurrentUser().getId();
        PageRequest pageable = PageRequest.of(page, Math.min(size, 100),
                Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        Page<Notification> notifications = unreadOnly
                ? notificationRepository.findByRecipientIdAndReadAtIsNull(userId, pageable)
                : notificationRepository.findByRecipientId(userId, pageable);
        return new NotificationPageResponseDto(notifications.stream()
                .map(notification -> modelMapper.map(notification, NotificationResponseDto.class)).toList(),
                notifications.getNumber(), notifications.getSize(), notifications.getTotalElements(),
                notifications.getTotalPages(), notificationRepository.countByRecipientIdAndReadAtIsNull(userId));
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional
    public NotificationResponseDto markAsRead(Long notificationId) {
        User user = userService.getCurrentUser();
        Notification notification = notificationRepository.findByIdAndRecipientId(notificationId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with id " + notificationId));
        notification.setReadAt(LocalDateTime.now());
        return modelMapper.map(notificationRepository.save(notification), NotificationResponseDto.class);
    }

    public void sendWelcomeEmail(Long userId) {
        User user = userService.getUserById(userId);
        queue.enqueue("EMAIL",new JobPayload(null,null,user.getEmail(),"Tu cuenta de Quesale","email/welcome",
                Map.of("name", user.getName(), "email", user.getEmail(), "actionUrl", links.plans(), "logoUrl", links.logo())));
    }

    @Transactional
    public void notifyInvitation(Long planId, Long userId) {
        Plan plan = planAccessService.getPlan(planId);
        User invitee = userService.getUserById(userId);
        EmailContent email = new EmailContent("Te invitaron a " + plan.getName(), "email/plan-invitation",
                Map.of("planName", plan.getName(), "organizerName", plan.getCreator().getName(),
                        "inviteCode", plan.getInviteCode(), "actionUrl", links.invitation(plan.getInviteCode()), "logoUrl", links.logo()));
        notify(invitee, plan, NotificationType.PLAN_INVITATION,
                plan.getCreator().getName() + " te invitó al plan " + plan.getName(), email);
    }

    @Transactional
    public void notifyPlanReady(Long planId) {
        Plan plan = planAccessService.getPlan(planId);
        EmailContent email = new EmailContent(plan.getName() + " está listo para cerrarse", "email/plan-ready",
                Map.of("planName", plan.getName(), "minParticipants", plan.getMinParticipants(),
                        "score", plan.getFeasibilityScore(), "actionUrl", links.plan(planId), "logoUrl", links.logo()));
        notify(plan.getCreator(), plan, NotificationType.MIN_PARTICIPANTS_REACHED,
                "El plan " + plan.getName() + " alcanzó el mínimo de confirmados y está listo para cerrarse", email);
    }

    @Transactional
    public void notifyPlanUpdated(Long planId) {
        Plan plan = planAccessService.getPlan(planId);
        for (PlanParticipant participant : participantRepository.findByPlanId(planId)) {
            if (!participant.isOrganizer()) {
                notify(participant.getUser(), plan, NotificationType.PLAN_UPDATED,
                        "El organizador actualizó los datos del plan " + plan.getName(), null);
            }
        }
    }

    @Transactional
    public void notifyPlanStatusChanged(Long planId) {
        Plan plan = planAccessService.getPlan(planId);
        boolean closed = plan.getStatus() == PlanStatus.CLOSED;
        NotificationType type = closed ? NotificationType.PLAN_CLOSED : plan.isOpen() ? NotificationType.PLAN_REOPENED : NotificationType.PLAN_CANCELLED;
        String message = closed
                ? "El plan " + plan.getName() + " quedó confirmado"
                : plan.isOpen() ? "El organizador reabrió " + plan.getName() + ". Revisen las opciones y vuelvan a confirmar."
                : "El plan " + plan.getName() + " fue cancelado";
        for (PlanParticipant participant : participantRepository.findByPlanId(planId)) {
            EmailContent email = closed ? buildClosedEmail(plan, participant.getUser()) : null;
            notify(participant.getUser(), plan, type, message, email);
        }
    }

    @Transactional
    public void notifyOrganizer(Plan plan, NotificationType type, String message) {
        notify(plan.getCreator(), plan, type, message, null);
    }

    @Transactional
    public void notifyJoinedParticipants(Plan plan, NotificationType type, String message) {
        participantRepository.findByPlanId(plan.getId()).stream()
                .filter(member -> member.getStatus() == ParticipationStatus.JOINED)
                .forEach(member -> notify(member.getUser(), plan, type, message, null));
    }

    private EmailContent buildClosedEmail(Plan plan, User recipient) {
        List<PlanOption> selected = optionRepository.findByPlanId(plan.getId()).stream()
                .filter(PlanOption::isSelected)
                .toList();
        return new EmailContent(plan.getName() + " está confirmado", "email/plan-closed", Map.of(
                "name", recipient.getName(),
                "planName", plan.getName(),
                "selectedDate", selectedLabel(selected, OptionType.DATE),
                "selectedPlace", selectedLabel(selected, OptionType.PLACE),
                "budget", plan.getBudget() == null ? "Sin definir" : String.format("S/ %.2f", plan.getBudget()),
                "actionUrl", links.plan(plan.getId()), "logoUrl", links.logo()));
    }

    private String selectedLabel(List<PlanOption> selected, OptionType type) {
        return selected.stream()
                .filter(option -> option.getType() == type)
                .map(option -> {
                    if (type != OptionType.DATE || option.getEffectiveDate() == null) return option.getLabel();
                    String time = option.getStartsAt() == null ? "Hora por acordar" :
                            option.getStartsAt().toLocalTime().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")) + " (Lima)";
                    String end = option.getEffectiveEndDate() == null ? "" : " – " + option.getEffectiveEndDate() +
                            (option.getEndsAt() == null ? "" : " · " + option.getEndsAt().toLocalTime().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")) + " (Lima)");
                    return option.getEffectiveDate() + " · " + time + end + " · " + option.getLabel();
                })
                .findFirst()
                .orElse("Por definir");
    }

    private void notify(User recipient, Plan plan, NotificationType type, String message, EmailContent email) {
        Notification notification = new Notification(recipient, plan, type, message);
        notification.setStatus(email == null ? NotificationStatus.SENT : NotificationStatus.PENDING);
        notification.setSentAt(email == null ? LocalDateTime.now() : null);
        notificationRepository.save(notification);
        if(email!=null) queue.enqueue("EMAIL",new JobPayload(null,notification.getId(),recipient.getEmail(),
                email.subject(),email.template(),email.variables()));
    }
}
