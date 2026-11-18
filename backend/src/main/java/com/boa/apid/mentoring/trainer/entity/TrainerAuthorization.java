package com.boa.apid.mentoring.trainer.entity;

import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.common.storage.StoredFile;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.skills.entity.Skill;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "trainer_authorizations", schema = "mentoring")
public class TrainerAuthorization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 30)
    private TrainerAuthorizationSource sourceType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_application_id")
    private MentorApplication sourceApplication;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TrainerAuthorizationStatus status = TrainerAuthorizationStatus.ACTIVE;

    @Column(name = "max_concurrent_trainees", nullable = false)
    private int maxConcurrentTrainees;

    @Column(length = 2000)
    private String bio;

    @Column(name = "availability_notes", length = 1000)
    private String availabilityNotes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "profile_picture_file_id")
    private StoredFile profilePicture;

    @Column(name = "experience_years")
    private Integer experienceYears;

    @Column(name = "mentoring_approach", length = 2000)
    private String mentoringApproach;

    @Column(name = "sessions_per_week")
    private Integer sessionsPerWeek;

    @Column(name = "appointment_reason", length = 1000)
    private String appointmentReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "authorized_by_user_id")
    private User authorizedBy;

    @Column(name = "status_reason", length = 1000)
    private String statusReason;

    @Column(name = "effective_from", nullable = false, updatable = false)
    private Instant effectiveFrom;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ManyToMany
    @JoinTable(
            name = "trainer_authorization_skills",
            schema = "mentoring",
            joinColumns = @JoinColumn(name = "trainer_auth_id"),
            inverseJoinColumns = @JoinColumn(name = "skill_id")
    )
    private Set<Skill> skills = new LinkedHashSet<>();

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (effectiveFrom == null) {
            effectiveFrom = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Employee getEmployee() { return employee; }
    public void setEmployee(Employee employee) { this.employee = employee; }
    public TrainerAuthorizationSource getSourceType() { return sourceType; }
    public void setSourceType(TrainerAuthorizationSource sourceType) { this.sourceType = sourceType; }
    public MentorApplication getSourceApplication() { return sourceApplication; }
    public void setSourceApplication(MentorApplication sourceApplication) { this.sourceApplication = sourceApplication; }
    public TrainerAuthorizationStatus getStatus() { return status; }
    public void setStatus(TrainerAuthorizationStatus status) { this.status = status; }
    public int getMaxConcurrentTrainees() { return maxConcurrentTrainees; }
    public void setMaxConcurrentTrainees(int maxConcurrentTrainees) { this.maxConcurrentTrainees = maxConcurrentTrainees; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getAvailabilityNotes() { return availabilityNotes; }
    public void setAvailabilityNotes(String availabilityNotes) { this.availabilityNotes = availabilityNotes; }
    public StoredFile getProfilePicture() { return profilePicture; }
    public void setProfilePicture(StoredFile profilePicture) { this.profilePicture = profilePicture; }
    public Integer getExperienceYears() { return experienceYears; }
    public void setExperienceYears(Integer experienceYears) { this.experienceYears = experienceYears; }
    public String getMentoringApproach() { return mentoringApproach; }
    public void setMentoringApproach(String mentoringApproach) { this.mentoringApproach = mentoringApproach; }
    public Integer getSessionsPerWeek() { return sessionsPerWeek; }
    public void setSessionsPerWeek(Integer sessionsPerWeek) { this.sessionsPerWeek = sessionsPerWeek; }
    public String getAppointmentReason() { return appointmentReason; }
    public void setAppointmentReason(String appointmentReason) { this.appointmentReason = appointmentReason; }
    public User getAuthorizedBy() { return authorizedBy; }
    public void setAuthorizedBy(User authorizedBy) { this.authorizedBy = authorizedBy; }
    public String getStatusReason() { return statusReason; }
    public void setStatusReason(String statusReason) { this.statusReason = statusReason; }
    public Instant getEffectiveFrom() { return effectiveFrom; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Set<Skill> getSkills() { return skills; }
    public void setSkills(Set<Skill> skills) { this.skills = skills; }
}
