package com.boa.apid.mentoring.application.entity;

import com.boa.apid.common.storage.StoredFile;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.skills.entity.Skill;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "mentor_applications", schema = "mentoring")
public class MentorApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "applicant_user_id", nullable = false)
    private User applicant;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private MentorApplicationStatus status = MentorApplicationStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "application_type", nullable = false, length = 30)
    private MentorApplicationType applicationType = MentorApplicationType.INITIAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_scope", nullable = false, length = 20)
    private MentorApplicationReviewScope reviewScope = MentorApplicationReviewScope.HR;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "proof_file_id")
    private StoredFile proofDocument;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_user_id")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "review_reason", columnDefinition = "TEXT")
    private String reviewReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "catalog_skill_id")
    private Skill catalogSkill;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "mentor_application_skills",
            schema = "mentoring",
            joinColumns = @JoinColumn(name = "application_id"),
            inverseJoinColumns = @JoinColumn(name = "skill_id")
    )
    private Set<Skill> catalogSkills = new LinkedHashSet<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "mentor_application_evidence",
            schema = "mentoring",
            joinColumns = @JoinColumn(name = "application_id"),
            inverseJoinColumns = @JoinColumn(name = "file_id")
    )
    private Set<StoredFile> supportingEvidence = new LinkedHashSet<>();

    @Column(name = "custom_skill", length = 1000)
    private String customSkill;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @Column(name = "evidence_contexts", columnDefinition = "TEXT")
    private String evidenceContexts;

    @Column(name = "expertise_summary", length = 2000)
    private String expertiseSummary;

    @Column(name = "profile_summary", columnDefinition = "TEXT")
    private String profileSummary;

    @Column(name = "experience_years")
    private Integer experienceYears;

    @Column(name = "mentoring_approach", length = 2000)
    private String mentoringApproach;

    @Column(name = "sessions_per_week")
    private Integer sessionsPerWeek;

    @Column(name = "max_concurrent_trainees")
    private Integer maxConcurrentTrainees;

    @Column(name = "mentor_agreement_version", length = 40)
    private String mentorAgreementVersion;

    @Column(name = "mentor_agreement_text", columnDefinition = "TEXT")
    private String mentorAgreementText;

    @Column(name = "mentor_agreement_accepted_at")
    private Instant mentorAgreementAcceptedAt;

    @Column(name = "submitted_at", nullable = false, updatable = false)
    private Instant submittedAt;

    @PrePersist
    void onCreate() {
        if (submittedAt == null) {
            submittedAt = Instant.now();
        }
    }

    public Long getId() { return id; }

    public User getApplicant() { return applicant; }
    public void setApplicant(User applicant) { this.applicant = applicant; }

    public MentorApplicationStatus getStatus() { return status; }
    public void setStatus(MentorApplicationStatus status) { this.status = status; }

    public MentorApplicationType getApplicationType() { return applicationType; }
    public void setApplicationType(MentorApplicationType applicationType) {
        this.applicationType = applicationType == null ? MentorApplicationType.INITIAL : applicationType;
    }

    public MentorApplicationReviewScope getReviewScope() { return reviewScope; }
    public void setReviewScope(MentorApplicationReviewScope reviewScope) {
        this.reviewScope = reviewScope == null ? MentorApplicationReviewScope.HR : reviewScope;
    }

    public StoredFile getProofDocument() { return proofDocument; }
    public void setProofDocument(StoredFile proofDocument) { this.proofDocument = proofDocument; }

    public User getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(User reviewedBy) { this.reviewedBy = reviewedBy; }

    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }

    public String getReviewReason() { return reviewReason; }
    public void setReviewReason(String reviewReason) { this.reviewReason = reviewReason; }

    public Skill getCatalogSkill() { return catalogSkill; }
    public void setCatalogSkill(Skill catalogSkill) { this.catalogSkill = catalogSkill; }

    public Set<Skill> getCatalogSkills() { return catalogSkills; }
    public void setCatalogSkills(Set<Skill> catalogSkills) {
        this.catalogSkills = catalogSkills == null ? new LinkedHashSet<>() : new LinkedHashSet<>(catalogSkills);
    }

    public Set<StoredFile> getSupportingEvidence() { return supportingEvidence; }
    public void setSupportingEvidence(Set<StoredFile> supportingEvidence) {
        this.supportingEvidence = supportingEvidence == null
                ? new LinkedHashSet<>() : new LinkedHashSet<>(supportingEvidence);
    }

    public String getCustomSkill() { return customSkill; }
    public void setCustomSkill(String customSkill) { this.customSkill = customSkill; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public String getEvidenceContexts() { return evidenceContexts; }
    public void setEvidenceContexts(String evidenceContexts) { this.evidenceContexts = evidenceContexts; }

    public String getExpertiseSummary() { return expertiseSummary; }
    public void setExpertiseSummary(String expertiseSummary) { this.expertiseSummary = expertiseSummary; }

    public String getProfileSummary() { return profileSummary; }
    public void setProfileSummary(String profileSummary) { this.profileSummary = profileSummary; }

    public Integer getExperienceYears() { return experienceYears; }
    public void setExperienceYears(Integer experienceYears) { this.experienceYears = experienceYears; }

    public String getMentoringApproach() { return mentoringApproach; }
    public void setMentoringApproach(String mentoringApproach) { this.mentoringApproach = mentoringApproach; }

    public Integer getSessionsPerWeek() { return sessionsPerWeek; }
    public void setSessionsPerWeek(Integer sessionsPerWeek) { this.sessionsPerWeek = sessionsPerWeek; }

    public Integer getMaxConcurrentTrainees() { return maxConcurrentTrainees; }
    public void setMaxConcurrentTrainees(Integer maxConcurrentTrainees) { this.maxConcurrentTrainees = maxConcurrentTrainees; }

    public String getMentorAgreementVersion() { return mentorAgreementVersion; }
    public void setMentorAgreementVersion(String mentorAgreementVersion) {
        this.mentorAgreementVersion = mentorAgreementVersion;
    }

    public String getMentorAgreementText() { return mentorAgreementText; }
    public void setMentorAgreementText(String mentorAgreementText) { this.mentorAgreementText = mentorAgreementText; }

    public Instant getMentorAgreementAcceptedAt() { return mentorAgreementAcceptedAt; }
    public void setMentorAgreementAcceptedAt(Instant mentorAgreementAcceptedAt) {
        this.mentorAgreementAcceptedAt = mentorAgreementAcceptedAt;
    }

    public Instant getSubmittedAt() { return submittedAt; }
}
