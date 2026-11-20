package com.boa.apid.coaching.session.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "coaching_session_turns", schema = "coaching")
public class CoachingSessionTurn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "turn_index", nullable = false)
    private Integer turnIndex;

    @Column(name = "speaker_employee_id", length = 50)
    private String speakerEmployeeId;

    @Column(name = "speaker_name", length = 120)
    private String speakerName;

    @Column(name = "speaker_role", nullable = false, length = 20)
    private String speakerRole; // 'COACH', 'COACHEE', 'SYSTEM', 'OTHER'

    @Column(name = "start_time_offset_sec", precision = 7, scale = 2)
    private BigDecimal startTimeOffsetSec;

    @Column(name = "duration_sec", precision = 6, scale = 2)
    private BigDecimal durationSec;

    @Column(name = "transcript_amharic", columnDefinition = "TEXT")
    private String transcriptAmharic;

    @Column(name = "transcript_english", columnDefinition = "TEXT")
    private String transcriptEnglish;

    @Column(name = "reconciled_text", nullable = false, columnDefinition = "TEXT")
    private String reconciledText;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public CoachingSessionTurn() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }

    public Integer getTurnIndex() { return turnIndex; }
    public void setTurnIndex(Integer turnIndex) { this.turnIndex = turnIndex; }

    public String getSpeakerEmployeeId() { return speakerEmployeeId; }
    public void setSpeakerEmployeeId(String speakerEmployeeId) { this.speakerEmployeeId = speakerEmployeeId; }

    public String getSpeakerName() { return speakerName; }
    public void setSpeakerName(String speakerName) { this.speakerName = speakerName; }

    public String getSpeakerRole() { return speakerRole; }
    public void setSpeakerRole(String speakerRole) { this.speakerRole = speakerRole; }

    public BigDecimal getStartTimeOffsetSec() { return startTimeOffsetSec; }
    public void setStartTimeOffsetSec(BigDecimal startTimeOffsetSec) { this.startTimeOffsetSec = startTimeOffsetSec; }

    public BigDecimal getDurationSec() { return durationSec; }
    public void setDurationSec(BigDecimal durationSec) { this.durationSec = durationSec; }

    public String getTranscriptAmharic() { return transcriptAmharic; }
    public void setTranscriptAmharic(String transcriptAmharic) { this.transcriptAmharic = transcriptAmharic; }

    public String getTranscriptEnglish() { return transcriptEnglish; }
    public void setTranscriptEnglish(String transcriptEnglish) { this.transcriptEnglish = transcriptEnglish; }

    public String getReconciledText() { return reconciledText; }
    public void setReconciledText(String reconciledText) { this.reconciledText = reconciledText; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
