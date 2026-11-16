package com.boa.apid.core.scheduling.entity;

import com.boa.apid.core.organization.entity.Employee;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "schedule_participants", schema = "core")
public class ScheduleParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_event_id", nullable = false)
    private ScheduleEvent scheduleEvent;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", insertable = false, updatable = false)
    private Employee employee;

    @Enumerated(EnumType.STRING)
    @Column(name = "participation_role", nullable = false, length = 30)
    private ParticipationRole participationRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "reservation_status", nullable = false, length = 30)
    private ReservationStatus reservationStatus = ReservationStatus.ACTIVE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public ScheduleParticipant() {}

    public ScheduleParticipant(ScheduleEvent scheduleEvent, Long employeeId, ParticipationRole role) {
        this.scheduleEvent = scheduleEvent;
        this.employeeId = employeeId;
        this.participationRole = role;
        this.reservationStatus = ReservationStatus.ACTIVE;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public ScheduleEvent getScheduleEvent() { return scheduleEvent; }
    public void setScheduleEvent(ScheduleEvent scheduleEvent) { this.scheduleEvent = scheduleEvent; }

    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }

    public Employee getEmployee() { return employee; }

    public ParticipationRole getParticipationRole() { return participationRole; }
    public void setParticipationRole(ParticipationRole participationRole) { this.participationRole = participationRole; }

    public ReservationStatus getReservationStatus() { return reservationStatus; }
    public void setReservationStatus(ReservationStatus reservationStatus) { this.reservationStatus = reservationStatus; }

    public Instant getCreatedAt() { return createdAt; }
}

