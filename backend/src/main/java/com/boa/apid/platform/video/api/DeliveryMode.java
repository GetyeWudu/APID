package com.boa.apid.platform.video.api;

/**
 * Standardized delivery mode for Coaching and Mentoring sessions.
 * ONLINE: Virtual meeting requiring a video room (LiveKit).
 * IN_PERSON: Physical meeting requiring a location.
 * HYBRID: Both a physical room and virtual video access for remote attendees.
 */
public enum DeliveryMode {
    ONLINE,
    IN_PERSON,
    HYBRID;

    public boolean isVideoRequired() {
        return this == ONLINE || this == HYBRID;
    }

    public boolean isLocationRequired() {
        return this == IN_PERSON || this == HYBRID;
    }
}
