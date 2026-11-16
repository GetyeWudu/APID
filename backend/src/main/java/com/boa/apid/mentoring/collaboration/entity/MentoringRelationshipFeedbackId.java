package com.boa.apid.mentoring.collaboration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class MentoringRelationshipFeedbackId implements Serializable {

    @Column(name = "relationship_id")
    private Long relationshipId;

    @Column(name = "trainee_employee_id")
    private Long traineeEmployeeId;

    public MentoringRelationshipFeedbackId() {
    }

    public MentoringRelationshipFeedbackId(Long relationshipId, Long traineeEmployeeId) {
        this.relationshipId = relationshipId;
        this.traineeEmployeeId = traineeEmployeeId;
    }

    public Long getRelationshipId() { return relationshipId; }
    public Long getTraineeEmployeeId() { return traineeEmployeeId; }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof MentoringRelationshipFeedbackId that)) return false;
        return Objects.equals(relationshipId, that.relationshipId)
                && Objects.equals(traineeEmployeeId, that.traineeEmployeeId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(relationshipId, traineeEmployeeId);
    }
}
