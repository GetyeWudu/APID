package com.boa.apid.mentoring.pairing.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class MentoringGroupPairingSourceId implements Serializable {

    @Column(name = "group_relationship_id")
    private Long groupRelationshipId;

    @Column(name = "source_relationship_id")
    private Long sourceRelationshipId;

    public MentoringGroupPairingSourceId() {}

    public MentoringGroupPairingSourceId(Long groupRelationshipId, Long sourceRelationshipId) {
        this.groupRelationshipId = groupRelationshipId;
        this.sourceRelationshipId = sourceRelationshipId;
    }

    public Long getGroupRelationshipId() { return groupRelationshipId; }
    public void setGroupRelationshipId(Long groupRelationshipId) { this.groupRelationshipId = groupRelationshipId; }
    public Long getSourceRelationshipId() { return sourceRelationshipId; }
    public void setSourceRelationshipId(Long sourceRelationshipId) { this.sourceRelationshipId = sourceRelationshipId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof MentoringGroupPairingSourceId)) return false;
        MentoringGroupPairingSourceId that = (MentoringGroupPairingSourceId) o;
        return Objects.equals(groupRelationshipId, that.groupRelationshipId)
                && Objects.equals(sourceRelationshipId, that.sourceRelationshipId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(groupRelationshipId, sourceRelationshipId);
    }
}
