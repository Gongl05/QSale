package com.example.qsale.exceptions;

public class AlreadyVotedException extends DuplicateResourceException {
    public AlreadyVotedException(String message) {
        super(message);
    }
}
