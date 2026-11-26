package com.boa.apid.mentoring.pairing.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "mentoring_session_targets", schema = "mentoring")
public class MentoringSessionTarget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private MentoringSession session;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "relationship_member_id", nullable = false)
    private MentoringRelationshipMember member;

    public Long getId() { return id; }
    public MentoringSession getSession() { return session; }
    public void setSession(MentoringSession session) { this.session = session; }
    public MentoringRelationshipMember getMember() { return member; }
    public void setMember(MentoringRelationshipMember member) { this.member = member; }
}
