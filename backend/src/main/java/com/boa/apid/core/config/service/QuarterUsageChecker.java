package com.boa.apid.core.config.service;

/**
 * Extension SPI implemented by downstream modules (Coaching, Mentoring) to prevent
 * mutating dates or removing FiscalQuarter records already referenced by historical records.
 */
public interface QuarterUsageChecker {
    boolean isQuarterReferenced(Long fiscalQuarterId);
}

