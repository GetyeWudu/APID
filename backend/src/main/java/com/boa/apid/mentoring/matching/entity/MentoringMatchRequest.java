package com.boa.apid.mentoring.matching.entity;

import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.skills.entity.Skill;
import com.boa.apid.mentoring.pairing.entity.MentoringRequest;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mentoring_match_requests", schema = "mentoring")
public class MentoringMatchRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trainee_employee_id", nullable = false)
    private Employee traineeEmployee;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "skill_id", nullable = false)
    private Skill skill;

    @Column(length = 1000)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MentoringMatchRequestStatus status = MentoringMatchRequestStatus.OPEN;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "matched_trainer_user_id")
    private User matchedTrainer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "matched_by_user_id")
    private User matchedBy;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mentoring_request_id")
    private MentoringRequest mentoringRequest;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Employee getTraineeEmployee() { return traineeEmployee; }
    public void setTraineeEmployee(Employee traineeEmployee) { this.traineeEmployee = traineeEmployee; }
    public Skill getSkill() { return skill; }
    public void setSkill(Skill skill) { this.skill = skill; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public MentoringMatchRequestStatus getStatus() { return status; }
    public void setStatus(MentoringMatchRequestStatus status) { this.status = status; }
    public User getMatchedTrainer() { return matchedTrainer; }
    public void setMatchedTrainer(User matchedTrainer) { this.matchedTrainer = matchedTrainer; }
    public User getMatchedBy() { return matchedBy; }
    public void setMatchedBy(User matchedBy) { this.matchedBy = matchedBy; }
    public MentoringRequest getMentoringRequest() { return mentoringRequest; }
    public void setMentoringRequest(MentoringRequest mentoringRequest) { this.mentoringRequest = mentoringRequest; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
