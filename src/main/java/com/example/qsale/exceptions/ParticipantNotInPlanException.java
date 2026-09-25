package com.example.qsale.exceptions;

public class ParticipantNotInPlanException extends ForbiddenException {
    public ParticipantNotInPlanException(String message) {
        super(message);
    }
}
