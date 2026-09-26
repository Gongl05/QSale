package com.example.qsale.notification.domain;

import com.example.qsale.exceptions.ResourceNotFoundException;
import com.example.qsale.notification.dto.NotificationResponseDto;
import com.example.qsale.notification.infrastructure.NotificationRepository;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
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
}
