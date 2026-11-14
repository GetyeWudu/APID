package com.boa.apid.mentoring.application.entity;

import com.boa.apid.common.storage.StoredFile;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.skills.entity.Skill;
import jakarta.persistence.*;

import java.time.Instant;

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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "proof_file_id", nullable = false)
    private StoredFile proofDocument;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "catalog_skill_id")
    private Skill catalogSkill;

    @Column(name = "custom_skill", length = 150)
    private String customSkill;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

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

    public StoredFile getProofDocument() { return proofDocument; }
    public void setProofDocument(StoredFile proofDocument) { this.proofDocument = proofDocument; }

    public Skill getCatalogSkill() { return catalogSkill; }
    public void setCatalogSkill(Skill catalogSkill) { this.catalogSkill = catalogSkill; }

    public String getCustomSkill() { return customSkill; }
    public void setCustomSkill(String customSkill) { this.customSkill = customSkill; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public Instant getSubmittedAt() { return submittedAt; }
}
