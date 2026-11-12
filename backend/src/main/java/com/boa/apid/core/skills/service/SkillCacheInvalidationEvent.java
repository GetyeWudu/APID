package com.boa.apid.core.skills.service;

/**
 * Domain event published inside skill mutations and consumed AFTER_COMMIT to evict Redis cache.
 */
public record SkillCacheInvalidationEvent() {}

