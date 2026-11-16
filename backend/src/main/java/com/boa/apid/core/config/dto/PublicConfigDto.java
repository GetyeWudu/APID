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
    private Integer coachingMaxSessionsPerWeek;
    private Boolean coachingAllowSaturdayScheduling;
    private String coachingRescheduleScope;
    private Boolean coachingAllowJointPmsGroup;
    private Integer coachingMaxJointGroupSize;

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
            Boolean coachingRequireDeclineReason,
            Integer coachingMaxSessionsPerWeek,
            Boolean coachingAllowSaturdayScheduling,
            String coachingRescheduleScope,
            Boolean coachingAllowJointPmsGroup,
            Integer coachingMaxJointGroupSize
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
        this.coachingMaxSessionsPerWeek = coachingMaxSessionsPerWeek;
        this.coachingAllowSaturdayScheduling = coachingAllowSaturdayScheduling;
        this.coachingRescheduleScope = coachingRescheduleScope;
        this.coachingAllowJointPmsGroup = coachingAllowJointPmsGroup;
        this.coachingMaxJointGroupSize = coachingMaxJointGroupSize;
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

    public Integer getCoachingMaxSessionsPerWeek() { return coachingMaxSessionsPerWeek; }
    public void setCoachingMaxSessionsPerWeek(Integer coachingMaxSessionsPerWeek) { this.coachingMaxSessionsPerWeek = coachingMaxSessionsPerWeek; }
    public Boolean getCoachingAllowSaturdayScheduling() { return coachingAllowSaturdayScheduling; }
    public void setCoachingAllowSaturdayScheduling(Boolean coachingAllowSaturdayScheduling) { this.coachingAllowSaturdayScheduling = coachingAllowSaturdayScheduling; }
    public String getCoachingRescheduleScope() { return coachingRescheduleScope; }
    public void setCoachingRescheduleScope(String coachingRescheduleScope) { this.coachingRescheduleScope = coachingRescheduleScope; }
    public Boolean getCoachingAllowJointPmsGroup() { return coachingAllowJointPmsGroup; }
    public void setCoachingAllowJointPmsGroup(Boolean coachingAllowJointPmsGroup) { this.coachingAllowJointPmsGroup = coachingAllowJointPmsGroup; }
    public Integer getCoachingMaxJointGroupSize() { return coachingMaxJointGroupSize; }
    public void setCoachingMaxJointGroupSize(Integer coachingMaxJointGroupSize) { this.coachingMaxJointGroupSize = coachingMaxJointGroupSize; }
}
