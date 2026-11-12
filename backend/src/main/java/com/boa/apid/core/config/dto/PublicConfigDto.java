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

    public PublicConfigDto() {
    }

    public PublicConfigDto(
            Integer mandatoryCutoffRounded,
            Integer missedSessionAlertThreshold,
            Integer inactivityReminderDays,
            Integer maxFileUploadMb
    ) {
        this.mandatoryCutoffRounded = mandatoryCutoffRounded;
        this.missedSessionAlertThreshold = missedSessionAlertThreshold;
        this.inactivityReminderDays = inactivityReminderDays;
        this.maxFileUploadMb = maxFileUploadMb;
    }

    public Integer getMandatoryCutoffRounded() { return mandatoryCutoffRounded; }
    public void setMandatoryCutoffRounded(Integer mandatoryCutoffRounded) { this.mandatoryCutoffRounded = mandatoryCutoffRounded; }
    public Integer getMissedSessionAlertThreshold() { return missedSessionAlertThreshold; }
    public void setMissedSessionAlertThreshold(Integer missedSessionAlertThreshold) { this.missedSessionAlertThreshold = missedSessionAlertThreshold; }
    public Integer getInactivityReminderDays() { return inactivityReminderDays; }
    public void setInactivityReminderDays(Integer inactivityReminderDays) { this.inactivityReminderDays = inactivityReminderDays; }
    public Integer getMaxFileUploadMb() { return maxFileUploadMb; }
    public void setMaxFileUploadMb(Integer maxFileUploadMb) { this.maxFileUploadMb = maxFileUploadMb; }
}

