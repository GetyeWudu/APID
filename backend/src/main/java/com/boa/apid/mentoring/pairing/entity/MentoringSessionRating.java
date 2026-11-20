package com.boa.apid.mentoring.pairing.entity;

import com.boa.apid.core.authorization.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(
        name = "mentoring_session_ratings",
        schema = "mentoring",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_mentoring_session_rating_per_mentee",
                columnNames = {"session_id", "mentee_user_id"}
        )
)
public class MentoringSessionRating {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private MentoringSession session;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mentee_user_id", nullable = false)
    private User menteeUser;

    @Column(nullable = false)
    private int rating;

    @Column(name = "rated_at", nullable = false, updatable = false)
    private Instant ratedAt;

    @PrePersist
    void onCreate() {
        if (ratedAt == null) {
            ratedAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public MentoringSession getSession() { return session; }
    public void setSession(MentoringSession session) { this.session = session; }
    public User getMenteeUser() { return menteeUser; }
    public void setMenteeUser(User menteeUser) { this.menteeUser = menteeUser; }
    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }
    public Instant getRatedAt() { return ratedAt; }
}
