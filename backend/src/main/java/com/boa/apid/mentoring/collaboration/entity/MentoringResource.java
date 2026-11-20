package com.boa.apid.mentoring.collaboration.entity;

import com.boa.apid.common.storage.StoredFile;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringSession;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mentoring_resources", schema = "mentoring")
public class MentoringResource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "relationship_id", nullable = false)
    private MentoringRelationship relationship;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private MentoringSession session;

    @Column(nullable = false, length = 180)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "resource_type", nullable = false, length = 20)
    private MentoringResourceType resourceType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id")
    private StoredFile file;

    @Column(name = "external_url", length = 1000)
    private String externalUrl;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uploaded_by_user_id", nullable = false)
    private User uploadedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public MentoringRelationship getRelationship() { return relationship; }
    public void setRelationship(MentoringRelationship relationship) { this.relationship = relationship; }
    public MentoringSession getSession() { return session; }
    public void setSession(MentoringSession session) { this.session = session; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public MentoringResourceType getResourceType() { return resourceType; }
    public void setResourceType(MentoringResourceType resourceType) { this.resourceType = resourceType; }
    public StoredFile getFile() { return file; }
    public void setFile(StoredFile file) { this.file = file; }
    public String getExternalUrl() { return externalUrl; }
    public void setExternalUrl(String externalUrl) { this.externalUrl = externalUrl; }
    public User getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(User uploadedBy) { this.uploadedBy = uploadedBy; }
    public Instant getCreatedAt() { return createdAt; }
}
