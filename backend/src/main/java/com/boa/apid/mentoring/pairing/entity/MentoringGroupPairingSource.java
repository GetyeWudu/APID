package com.boa.apid.mentoring.pairing.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mentoring_group_pairing_sources", schema = "mentoring")
public class MentoringGroupPairingSource {

    @EmbeddedId
    private MentoringGroupPairingSourceId id = new MentoringGroupPairingSourceId();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("groupRelationshipId")
    @JoinColumn(name = "group_relationship_id", nullable = false)
    private MentoringRelationship groupRelationship;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("sourceRelationshipId")
    @JoinColumn(name = "source_relationship_id", nullable = false)
    private MentoringRelationship sourceRelationship;

    @Column(name = "merged_at", nullable = false)
    private Instant mergedAt;

    @PrePersist
    void onCreate() {
        if (mergedAt == null) {
            mergedAt = Instant.now();
        }
    }

    public MentoringGroupPairingSourceId getId() { return id; }
    public MentoringRelationship getGroupRelationship() { return groupRelationship; }
    public void setGroupRelationship(MentoringRelationship groupRelationship) {
        this.groupRelationship = groupRelationship;
        this.id.setGroupRelationshipId(groupRelationship.getId());
    }
    public MentoringRelationship getSourceRelationship() { return sourceRelationship; }
    public void setSourceRelationship(MentoringRelationship sourceRelationship) {
        this.sourceRelationship = sourceRelationship;
        this.id.setSourceRelationshipId(sourceRelationship.getId());
    }
    public Instant getMergedAt() { return mergedAt; }
}
