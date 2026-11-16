package com.boa.apid.core.config.dto;

/**
 * Explicitly allowlisted safe settings exposed to authenticated portal users.
 * Non-final with public no-arg constructor for Redis serialization compatibility.
 */
public class PublicConfigDto {

    private Integer mandatoryCutoffRounded;
    private Integer missedSessionAlertThreshold;
    private Integer inactivityReminderDays;
    private Integer maxFileUploadMb;
    private Integer coachingMinSessionsPerQuarter;
    private Integer coachingEarlyJoinWindowMinutes;
    private Integer coachingMinRescheduleNoticeHours;
    private Integer coachingMaxReschedulesPerSession;
    private Boolean coachingRequireDeclineReason;

    public PublicConfigDto() {
    }

    public PublicConfigDto(
            Integer mandatoryCutoffRounded,
            Integer missedSessionAlertThreshold,
            Integer inactivityReminderDays,
            Integer maxFileUploadMb,
            Integer coachingMinSessionsPerQuarter,
            Integer coachingEarlyJoinWindowMinutes,
            Integer coachingMinRescheduleNoticeHours,
            Integer coachingMaxReschedulesPerSession,
            Boolean coachingRequireDeclineReason
    ) {
        this.mandatoryCutoffRounded = mandatoryCutoffRounded;
        this.missedSessionAlertThreshold = missedSessionAlertThreshold;
        this.inactivityReminderDays = inactivityReminderDays;
        this.maxFileUploadMb = maxFileUploadMb;
        this.coachingMinSessionsPerQuarter = coachingMinSessionsPerQuarter;
        this.coachingEarlyJoinWindowMinutes = coachingEarlyJoinWindowMinutes;
        this.coachingMinRescheduleNoticeHours = coachingMinRescheduleNoticeHours;
        this.coachingMaxReschedulesPerSession = coachingMaxReschedulesPerSession;
        this.coachingRequireDeclineReason = coachingRequireDeclineReason;
    }

    public Integer getMandatoryCutoffRounded() { return mandatoryCutoffRounded; }
    public void setMandatoryCutoffRounded(Integer mandatoryCutoffRounded) { this.mandatoryCutoffRounded = mandatoryCutoffRounded; }
    public Integer getMissedSessionAlertThreshold() { return missedSessionAlertThreshold; }
    public void setMissedSessionAlertThreshold(Integer missedSessionAlertThreshold) { this.missedSessionAlertThreshold = missedSessionAlertThreshold; }
    public Integer getInactivityReminderDays() { return inactivityReminderDays; }
    public void setInactivityReminderDays(Integer inactivityReminderDays) { this.inactivityReminderDays = inactivityReminderDays; }
    public Integer getMaxFileUploadMb() { return maxFileUploadMb; }
    public void setMaxFileUploadMb(Integer maxFileUploadMb) { this.maxFileUploadMb = maxFileUploadMb; }

    public Integer getCoachingMinSessionsPerQuarter() { return coachingMinSessionsPerQuarter; }
    public void setCoachingMinSessionsPerQuarter(Integer coachingMinSessionsPerQuarter) { this.coachingMinSessionsPerQuarter = coachingMinSessionsPerQuarter; }
    public Integer getCoachingEarlyJoinWindowMinutes() { return coachingEarlyJoinWindowMinutes; }
    public void setCoachingEarlyJoinWindowMinutes(Integer coachingEarlyJoinWindowMinutes) { this.coachingEarlyJoinWindowMinutes = coachingEarlyJoinWindowMinutes; }
    public Integer getCoachingMinRescheduleNoticeHours() { return coachingMinRescheduleNoticeHours; }
    public void setCoachingMinRescheduleNoticeHours(Integer coachingMinRescheduleNoticeHours) { this.coachingMinRescheduleNoticeHours = coachingMinRescheduleNoticeHours; }
    public Integer getCoachingMaxReschedulesPerSession() { return coachingMaxReschedulesPerSession; }
    public void setCoachingMaxReschedulesPerSession(Integer coachingMaxReschedulesPerSession) { this.coachingMaxReschedulesPerSession = coachingMaxReschedulesPerSession; }
    public Boolean getCoachingRequireDeclineReason() { return coachingRequireDeclineReason; }
    public void setCoachingRequireDeclineReason(Boolean coachingRequireDeclineReason) { this.coachingRequireDeclineReason = coachingRequireDeclineReason; }
}

