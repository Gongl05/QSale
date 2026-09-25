package com.example.qsale.exceptions;

public class DuplicateResourceException extends ConflictException {
    public DuplicateResourceException(String message) {
        super(message);
    }
}
