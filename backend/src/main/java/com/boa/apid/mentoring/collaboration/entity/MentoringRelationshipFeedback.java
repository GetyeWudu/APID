package com.boa.apid.mentoring.collaboration.entity;

import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mentoring_relationship_trainees", schema = "mentoring")
public class MentoringRelationshipFeedback {

    @EmbeddedId
    private MentoringRelationshipFeedbackId id;

    @MapsId("relationshipId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "relationship_id", nullable = false)
    private MentoringRelationship relationship;

    @MapsId("traineeEmployeeId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trainee_employee_id", nullable = false)
    private Employee traineeEmployee;

    @Column(nullable = false)
    private int rating;

    @Column(length = 2000)
    private String feedback;

    @Column(name = "rated_at", nullable = false)
    private Instant ratedAt;

    @PrePersist
    void onCreate() {
        if (ratedAt == null) {
            ratedAt = Instant.now();
        }
    }

    public MentoringRelationshipFeedbackId getId() { return id; }
    public void setId(MentoringRelationshipFeedbackId id) { this.id = id; }
    public MentoringRelationship getRelationship() { return relationship; }
    public void setRelationship(MentoringRelationship relationship) { this.relationship = relationship; }
    public Employee getTraineeEmployee() { return traineeEmployee; }
    public void setTraineeEmployee(Employee traineeEmployee) { this.traineeEmployee = traineeEmployee; }
    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }
    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }
    public Instant getRatedAt() { return ratedAt; }
}
