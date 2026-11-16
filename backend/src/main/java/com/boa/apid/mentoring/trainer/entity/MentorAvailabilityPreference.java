package com.boa.apid.mentoring.trainer.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;

import java.time.Instant;

@Entity
@Table(name = "mentor_availability_preferences", schema = "mentoring")
public class MentorAvailabilityPreference {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "accepting_new_pairings", nullable = false)
    private boolean acceptingNewPairings = true;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        if (updatedAt == null) {
            updatedAt = Instant.now();
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public boolean isAcceptingNewPairings() { return acceptingNewPairings; }
    public void setAcceptingNewPairings(boolean acceptingNewPairings) {
        this.acceptingNewPairings = acceptingNewPairings;
    }
}
