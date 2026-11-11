package com.boa.apid.core.identity.dto;

public record CreateUserResponse(AdminUserDto user, String temporaryPassword) {}

