package com.example.qsale.notification.dto;

import com.example.qsale.notification.domain.NotificationStatus;
import com.example.qsale.notification.domain.NotificationType;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class NotificationResponseDto {
    private Long id;
    private Long planId;
    private NotificationType type;
    private String message;
    private NotificationStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime readAt;
}
