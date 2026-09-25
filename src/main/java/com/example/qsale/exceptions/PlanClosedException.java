package com.example.qsale.exceptions;

public class PlanClosedException extends ConflictException {
    public PlanClosedException(String message) {
        super(message);
    }
}
