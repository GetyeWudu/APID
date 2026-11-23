package com.boa.apid.coaching.communication.dto;

public class EligibleMentoringPeerDto {

    private Long employeeId;
    private Long userId;
    private String fullName;
    private String email;
    private String jobTitle;
    private Long skillId;
    private String skillName;
    private String mentorName;
    private Long relationshipId;

    public EligibleMentoringPeerDto() {}

    public EligibleMentoringPeerDto(
            Long employeeId,
            Long userId,
            String fullName,
            String email,
            String jobTitle,
            Long skillId,
            String skillName,
            String mentorName,
            Long relationshipId
    ) {
        this.employeeId = employeeId;
        this.userId = userId;
        this.fullName = fullName;
        this.email = email;
        this.jobTitle = jobTitle;
        this.skillId = skillId;
        this.skillName = skillName;
        this.mentorName = mentorName;
        this.relationshipId = relationshipId;
    }

    public Long getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Long employeeId) {
        this.employeeId = employeeId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getJobTitle() {
        return jobTitle;
    }

    public void setJobTitle(String jobTitle) {
        this.jobTitle = jobTitle;
    }

    public String getSkillName() {
        return skillName;
    }

    public Long getSkillId() {
        return skillId;
    }

    public void setSkillId(Long skillId) {
        this.skillId = skillId;
    }

    public void setSkillName(String skillName) {
        this.skillName = skillName;
    }

    public String getMentorName() {
        return mentorName;
    }

    public void setMentorName(String mentorName) {
        this.mentorName = mentorName;
    }

    public Long getRelationshipId() {
        return relationshipId;
    }

    public void setRelationshipId(Long relationshipId) {
        this.relationshipId = relationshipId;
    }
}
