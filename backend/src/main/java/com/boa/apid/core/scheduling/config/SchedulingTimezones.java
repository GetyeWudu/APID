package com.boa.apid.core.scheduling.config;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.Instant;

/**
 * Enterprise standard timezones for Bank of Abyssinia.
 * Ethiopia operates on East Africa Time (EAT), UTC+3, with no daylight saving shifts.
 */
public final class SchedulingTimezones {

    public static final ZoneId DEFAULT_ZONE = ZoneId.of("Africa/Addis_Ababa");
    public static final String DEFAULT_ZONE_ID = "Africa/Addis_Ababa";

    private SchedulingTimezones() {}

    /**
     * Resolves a local date and time in Addis Ababa to a UTC Instant.
     */
    public static Instant toUtcInstant(LocalDate localDate, LocalTime localTime) {
        return toUtcInstant(localDate, localTime, DEFAULT_ZONE);
    }

    public static Instant toUtcInstant(LocalDate localDate, LocalTime localTime, ZoneId zoneId) {
        ZoneId zone = zoneId != null ? zoneId : DEFAULT_ZONE;
        return ZonedDateTime.of(localDate, localTime, zone).toInstant();
    }

    /**
     * Converts an Instant to local ZonedDateTime in Addis Ababa.
     */
    public static ZonedDateTime toLocalZoned(Instant instant) {
        return instant.atZone(DEFAULT_ZONE);
    }

    /**
     * Finds the next occurrence of a given DayOfWeek on or after fromDate.
     */
    public static LocalDate nextOrSame(LocalDate fromDate, DayOfWeek targetDay) {
        LocalDate cursor = fromDate;
        while (cursor.getDayOfWeek() != targetDay) {
            cursor = cursor.plusDays(1);
        }
        return cursor;
    }
}

