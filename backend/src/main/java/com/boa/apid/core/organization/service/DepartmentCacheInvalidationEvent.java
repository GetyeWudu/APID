package com.boa.apid.core.organization.service;

/**
 * Domain event published inside organization mutations and consumed AFTER_COMMIT to evict Redis cache.
 */
public record DepartmentCacheInvalidationEvent() {}

