package com.boa.apid.mentoring.pairing.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(
        name = "mentoring_session_attendees",
        schema = "mentoring",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_mentoring_session_attendee",
                columnNames = {"session_id", "relationship_member_id"}
        )
)
public class MentoringSessionAttendee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private MentoringSession session;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "relationship_member_id", nullable = false)
    private MentoringRelationshipMember member;

    @Column(name = "accepted_scheduled_start")
    private Instant acceptedScheduledStart;

    public Long getId() { return id; }
    public MentoringSession getSession() { return session; }
    public void setSession(MentoringSession session) { this.session = session; }
    public MentoringRelationshipMember getMember() { return member; }
    public void setMember(MentoringRelationshipMember member) { this.member = member; }
    public Instant getAcceptedScheduledStart() { return acceptedScheduledStart; }
    public void setAcceptedScheduledStart(Instant acceptedScheduledStart) {
        this.acceptedScheduledStart = acceptedScheduledStart;
    }

    public boolean hasAccepted(Instant scheduledStart) {
        return acceptedScheduledStart != null && acceptedScheduledStart.equals(scheduledStart);
    }
}
