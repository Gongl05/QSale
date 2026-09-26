package com.example.qsale.notification.domain;

import com.example.qsale.exceptions.ResourceNotFoundException;
import com.example.qsale.notification.dto.NotificationResponseDto;
import com.example.qsale.notification.infrastructure.NotificationRepository;
import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.domain.PlanOption;
import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.participant.domain.PlanParticipant;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.plan.domain.PlanAccessService;
import com.example.qsale.plan.domain.PlanStatus;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final EmailService emailService;
    private final UserService userService;
    private final ModelMapper modelMapper;

    public List<NotificationResponseDto> getMyNotifications(boolean unreadOnly) {
        Long userId = userService.getCurrentUser().getId();
        List<Notification> notifications = unreadOnly
                ? notificationRepository.findByRecipientIdAndReadAtIsNullOrderByCreatedAtDesc(userId)
                : notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId);
        return notifications.stream()
                .map(notification -> modelMapper.map(notification, NotificationResponseDto.class))
                .toList();
    }

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
        emailService.sendHtmlEmail(user.getEmail(), "Bienvenido a QSale", "email/welcome",
                Map.of("name", user.getName(), "email", user.getEmail()));
    }

    @Transactional
    public void notifyInvitation(Long planId, Long userId) {
        Plan plan = planAccessService.getPlan(planId);
        User invitee = userService.getUserById(userId);
        EmailContent email = new EmailContent("Te invitaron a " + plan.getName(), "email/plan-invitation",
                Map.of("planName", plan.getName(), "organizerName", plan.getCreator().getName(),
                        "inviteCode", plan.getInviteCode()));
        notify(invitee, plan, NotificationType.PLAN_INVITATION,
                plan.getCreator().getName() + " te invitó al plan " + plan.getName(), email);
    }

    @Transactional
    public void notifyPlanReady(Long planId) {
        Plan plan = planAccessService.getPlan(planId);
        EmailContent email = new EmailContent(plan.getName() + " está listo para cerrarse", "email/plan-ready",
                Map.of("planName", plan.getName(), "minParticipants", plan.getMinParticipants(),
                        "score", plan.getFeasibilityScore()));
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
        NotificationType type = closed ? NotificationType.PLAN_CLOSED : NotificationType.PLAN_CANCELLED;
        String message = closed
                ? "El plan " + plan.getName() + " quedó confirmado"
                : "El plan " + plan.getName() + " fue cancelado";
        for (PlanParticipant participant : participantRepository.findByPlanId(planId)) {
            EmailContent email = closed ? buildClosedEmail(plan, participant.getUser()) : null;
            notify(participant.getUser(), plan, type, message, email);
        }
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
                "budget", plan.getBudget() == null ? "Sin definir" : String.format("S/ %.2f", plan.getBudget())));
    }

    private String selectedLabel(List<PlanOption> selected, OptionType type) {
        return selected.stream()
                .filter(option -> option.getType() == type)
                .map(PlanOption::getLabel)
                .findFirst()
                .orElse("Por definir");
    }

    private void notify(User recipient, Plan plan, NotificationType type, String message, EmailContent email) {
        Notification notification = new Notification(recipient, plan, type, message);
        boolean delivered = email == null || emailService.sendHtmlEmail(
                recipient.getEmail(), email.subject(), email.template(), email.variables());
        notification.setStatus(delivered ? NotificationStatus.SENT : NotificationStatus.FAILED);
        notification.setSentAt(delivered ? LocalDateTime.now() : null);
        notificationRepository.save(notification);
    }
}
