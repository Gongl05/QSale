package com.example.qsale.plan.dto;

/** A person who joined the plan, as shown in the faces on a plan card. */
public record PlanMemberDto(Long userId, String name, String nickname, Long avatarVersion) {
}
