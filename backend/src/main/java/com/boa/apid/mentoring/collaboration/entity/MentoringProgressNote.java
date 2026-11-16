package com.boa.apid.mentoring.collaboration.entity;

import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mentoring_progress_notes", schema = "mentoring")
public class MentoringProgressNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "relationship_id", nullable = false)
    private MentoringRelationship relationship;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_user_id", nullable = false)
    private User author;

    @Column(nullable = false, length = 2000)
    private String note;

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
    public User getAuthor() { return author; }
    public void setAuthor(User author) { this.author = author; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public Instant getCreatedAt() { return createdAt; }
}
