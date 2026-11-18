package com.boa.apid.coaching.session.entity;

import com.boa.apid.platform.video.api.DeliveryMode;

public enum SessionMeetingMode {
    ONLINE,
    IN_PERSON,
    HYBRID,
    // Backward-compatible aliases for legacy coaching records
    VIRTUAL_VIDEO,
    PHONE_CALL;

    public boolean isVideoRequired() {
        return this == ONLINE || this == HYBRID || this == VIRTUAL_VIDEO;
    }

    public boolean isLocationRequired() {
        return this == IN_PERSON || this == HYBRID;
    }

    public DeliveryMode toDeliveryMode() {
        return switch (this) {
            case IN_PERSON, PHONE_CALL -> DeliveryMode.IN_PERSON;
            case HYBRID -> DeliveryMode.HYBRID;
            default -> DeliveryMode.ONLINE;
        };
    }
}
