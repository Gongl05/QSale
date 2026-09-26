package com.example.qsale.notification.domain;

import java.util.Map;

public record EmailContent(String subject, String template, Map<String, Object> variables) {
}
