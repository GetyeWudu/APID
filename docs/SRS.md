# Software Requirements Specification (SRS)
## APID — Abyssinia Personal Intelligence and Development

| Metadata | Value |
| :--- | :--- |
| **Document Version** | 2.0 (Comprehensive Engineering Baseline) |
| **Project Code / Name** | APID — Abyssinia Personal Intelligence and Development |
| **Organization** | Bank of Abyssinia (BOA) |
| **Primary Stakeholders** | PMS Department, Human Resources (HR), System Administration, Department Managers, Employees |
| **Module Ownership** | **Coaching Module:** Developer 1 · **Mentoring Module:** Developer 2 · **Shared Core:** Joint |
| **Backend Technology** | Java 17, Spring Boot, Spring Security, Spring Data JPA, Flyway, PostgreSQL 16, Redis 7 |
| **Frontend Technology** | React, Vite, TypeScript |
| **Live Video Provider** | Daily.co |
| **Containerization** | Docker & Docker Compose (Backend + PostgreSQL + Redis only; Frontend runs locally) |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Architecture, Organizational Context & Dynamic Access Control](#2-system-architecture-organizational-context--dynamic-access-control)
3. [Shared Core Platform Requirements (`FR-CORE`)](#3-shared-core-platform-requirements-fr-core)
4. [Coaching Module Functional Requirements (`FR-COACH`)](#4-coaching-module-functional-requirements-fr-coach)
5. [Mentoring Module Functional Requirements (`FR-MENTOR`)](#5-mentoring-module-functional-requirements-fr-mentor)
6. [Notifications Matrix (`FR-NOTIF`)](#6-notifications-matrix-fr-notif)
7. [Reporting, Analytics & Exports (`FR-RPT`)](#7-reporting-analytics--exports-fr-rpt)
8. [Conceptual Data Model & Schema Ownership](#8-conceptual-data-model--schema-ownership)
9. [Caching, Background Workers & Docker Architecture](#9-caching-background-workers--docker-architecture)
10. [API Conventions, Security & Non-Functional Requirements (`NFR`)](#10-api-conventions-security--non-functional-requirements-nfr)
11. [End-to-End Business Scenarios & Acceptance Criteria](#11-end-to-end-business-scenarios--acceptance-criteria)
12. [Remaining Confirmation Items & Implementation Roadmap](#12-remaining-confirmation-items--implementation-roadmap)

---

## 1. Introduction

### 1.1 Purpose
**APID (Abyssinia Personal Intelligence and Development)** is an internal employee performance improvement, skill development, and knowledge-sharing platform for **Bank of Abyssinia**.

This SRS provides the complete functional, data, integration, security, and operational specification so **both developers** (and senior reviewers) share the exact same understanding of:
- How the **Coaching Module** (owned by the **PMS Department**) works end to end.
- How the **Mentoring Module** (owned by **Human Resources**) works end to end.
- How the **Shared Core** unites users, dynamic permissions, organizational hierarchy, skills, Daily.co live video, chat, file storage, notifications, caching, and background workers into **one modular monolith**.

### 1.2 Objectives
1. **Automatically identify performance gaps** from quarterly PMS Excel appraisal exports by consolidating repeated multi-goal rows per employee and evaluating **`RoundedOverallFinalRating < 3`** (`1` or `2`).
2. **Enforce structured managerial accountability** by automatically pairing underperforming employees (`Talent`) with their direct hierarchical manager (`Coach`) from the pre-loaded `core.employees` + manager directory, recursively up the reporting chain.
3. **Support proactive skill development** for satisfactory performers (`RoundedOverallFinalRating >= 3`) through manager-requested, PMS-approved individual or group coaching.
4. **Provide transparent coaching oversight** to PMS via mandatory per-session Coach reports, optional Talent reflection reports, attendance tracking, and quarterly filters.
5. **Unlock internal organizational expertise** through an HR-controlled Mentoring module allowing employees to apply as Trainers (or be directly appointed by HR) and connect with Trainees.
6. **Eliminate fixed role rigidity** via a dynamic RBAC and contextual participation architecture where one employee can act concurrently as `Coach`, `Talent`, `Trainer`, and `Trainee`.
7. **Preserve historical integrity** across promotions, transfers, coach replacements, and repeated quarterly evaluations.

### 1.3 System Scope

#### In Scope (Version 1.0 Release)
- Phase 1 local authentication (`username` + `password` with JWT), built behind an Active Directory–ready user schema (`core.users` linked explicitly or provisioned for `core.employees`).
- System-Admin-managed dynamic Roles & granular Permissions.
- Organizational hierarchy & user directory management (`core.departments`, `core.employees` with `manager_id` self-FK and `user_id` FK) via Phase 3 Standard CSV/Excel bulk import (managed independently from PMS reports).
- Shared Master `Skill` catalog.
- Quarterly PMS multi-goal `.xlsx`/`.csv` appraisal import, goal-average & rounding verification, preview-and-confirm pipeline matched against pre-existing directory employees, and immutable import audit logs.
- Performance-based mandatory coaching (`RoundedOverallFinalRating < 3` entry, `>= 3` exit) and mid-quarter Coach replacement.
- Manager-initiated individual & group skill-development coaching requests, PMS review, and Coach-decided completion.
- Trainer applications with certificate uploads, HR review/approval/rejection, direct HR Trainer appointments, and `Suspend`/`Revoke` lifecycle.
- Three coexisting Mentoring discovery/matching modes: Trainer browsing, automated skill recommendations, and HR-assisted manual matching.
- Shared session scheduling, Daily.co private video rooms + participant tokens + join-time attendance capture, REST-polled scoped chat, file sharing via `./uploads`, and in-app notifications.
- Quarterly-filtered PMS & HR reporting dashboards with Excel/PDF export.
- Selective Redis caching and Spring `@Scheduled` / `@Async` background workers.
- Backend-only Docker Compose stack (`postgres`, `redis`, `backend`).

#### Phase 2 Planned Evolution (Architectural Readiness Built Into v1.0)
- **Bank Active Directory (AD) Integration:** Replace/augment local password login with Bank AD authentication and nightly automatic sync of Directors, Divisions, Managers, and Employees.
- **MinIO / S3 Object Storage:** Swap `LocalFileStorageService` for an S3-compatible implementation via the `FileStorageService` interface.
- **WebSocket / STOMP Real-Time Chat:** Upgrade REST-polled chat endpoints to persistent WebSockets if real-time push typing/delivery is required.
- **Email / SMS Gateway Integration:** Extend `NotificationSender` to dispatch external bank emails/SMS alongside in-app alerts.

#### Explicitly Out of Scope (v1.0)
- Formal examination, quiz, or automated grading engine inside Coaching.
- Building a custom WebRTC video server from scratch (Daily.co is used instead).
- Replacing the bank's core HRIS/ERP or core PMS appraisal calculation system.
- Automated external verification of uploaded academic/professional certificates.
- Containerizing the React/Vite frontend in Docker.

### 1.4 Domain Glossary

| Term | Definition |
| :--- | :--- |
| **APID** | Abyssinia Personal Intelligence and Development. |
| **PMS** | Performance Management System department; owns and monitors the **Coaching Module**. |
| **HR** | Human Resources department; owns and monitors the **Mentoring Module**. |
| **Performance Quarter** | The completed appraisal period evaluated by PMS (e.g., Q1). |
| **Coaching Quarter** | The subsequent ~3-month period during which assigned coaching occurs (e.g., Q1 results drive Q2 coaching). |
| **OverallFinalRating** | Average of an employee's `GoalScore` rows out of `5.0` in the PMS Excel export (e.g., `2.2325`, `2.9500`), repeated identically across each of that employee's goal rows. Stored for analytics and goal-average verification. |
| **RoundedOverallFinalRating** | Integer rounded final grade (`1–5`) computed from `OverallFinalRating` (e.g., `2.9500 -> 3`, `2.2325 -> 2`). **AUTHORITATIVE** grade used for exact coaching comparison (`< 3` triggers Mandatory Coaching). |
| **Coach** | Contextual participant assigned to guide a Talent in Coaching (default: direct manager for mandatory coaching). |
| **Talent** | Contextual participant receiving mandatory or skill-development coaching. |
| **Trainer** | Employee authorized by HR (via application approval or direct appointment) to teach specific skills in Mentoring. |
| **Trainee** | Employee enrolled to learn a skill from a Trainer in Mentoring. |
| **Daily.co** | External Video API used to generate private meeting rooms, participant tokens, and attendance webhooks. |
| **Active Directory (AD)** | Bank enterprise directory planned for Phase 2 SSO and automated hierarchy synchronization. |

---

## 2. System Architecture, Organizational Context & Dynamic Access Control

### 2.1 High-Level Module Boundaries
APID is designed as a **Modular Monolith** with three business domains (`core`, `coaching`, `mentoring`) and shared cross-cutting infrastructure (`common`):

| Domain | Controlling Authority | Developer Ownership | Core Responsibility |
| :--- | :--- | :--- | :--- |
| **Shared Core (`core`)** | System Administrator / Joint | **Joint (Both Developers)** | Users, Auth, Org Hierarchy, Dynamic RBAC, Master Skills, Notifications, File Storage, Daily.co Video, Audit Logs, System Config |
| **Coaching Module (`coaching`)** | PMS Department | **Developer 1 (You)** | PMS Excel Upload, Appraisal Extraction, Mandatory Coaching, Skill-Dev Coaching Requests, Coach Replacement, Sessions, Session Reports, PMS Analytics |
| **Mentoring Module (`mentoring`)** | HR Department | **Developer 2 (Friend)** | Trainer Applications, Document Review, Direct Appointment, Suspend/Revoke Lifecycle, Discovery & Matching, Mentoring Requests & Relationships, HR Analytics |

### 2.2 Organizational Hierarchy & Recursive Coaching Rule
APID models the bank's reporting structure independently of system security roles:

```text
Director of Human Resource Development (Mr. Abebe)
├── Division 1 Manager (Mr. Kebede)
│   └── Employee (Mr. Alex)
├── Division 2 Manager
│   └── Employees...
├── Division 3 Manager
│   └── Employees...
└── Division 4 Manager
    └── Employees...
```

**Recursive Assignment Behavior:**
- If **Mr. Alex** receives `RoundedOverallFinalRating < 3` (e.g., `2`), APID looks up Alex's direct manager (**Mr. Kebede**) in `core.employees` (`manager_id`) -> **Kebede = Coach**, **Alex = Talent**.
- If **Mr. Kebede** also receives `RoundedOverallFinalRating < 3` in the same or another quarter, APID looks up Kebede's direct manager (**Mr. Abebe**) -> **Abebe = Coach**, **Kebede = Talent**.
- **Result:** Mr. Kebede simultaneously participates as a **Coach** (to Alex) and a **Talent** (under Abebe).

**Critical Rule (`BR-005`):** There are **NO fixed system roles called `Manager` or `Director`**. "Manager" and "Director" are organizational reporting relationships stored in the hierarchy data.

### 2.3 Three-Layer Access & Participation Model

To satisfy dynamic multi-role participation (`BR-024`) without security leaks:

1. **Layer 1 — Dynamic System Roles & Permissions (Global / Module Authority):**
   - Backend defines a fixed catalog of **granular permission codes** enforced by Spring Security (`@PreAuthorize`).
   - System Administrator dynamically creates, edits, renames, or deactivates **Roles** (e.g., `PMS Admin`, `HR Admin`, `Employee`, `Department Coordinator`) and maps any combination of permissions to each Role.
   - A user can hold **one or multiple System Roles** simultaneously.
   - **Safety Guardrail:** System Admin cannot delete or strip role-management permissions from the last active Super Admin account (prevents total system lockout).

2. **Layer 2 — Organizational Reporting Hierarchy (Data Layer):**
   - Stores `employeeNumber`, `parentDepartment`, `department`, `job`, `position`, and `managerEmployeeNumber`.
   - Determines default Coach assignment and manager authority to submit Skill-Development Coaching requests for subordinates.

3. **Layer 3 — Contextual Assignment Participation (Relationship-Scoped Authority):**
   - Being `Coach`, `Talent`, `Trainer`, or `Trainee` is derived from **active database relationships**, not static system roles:
     - **Coach Access:** Granted only for `CoachingAssignment` records where `user == assignment.currentCoach`.
     - **Talent Access:** Granted only for `CoachingAssignment` records where `user` is an assigned Talent participant.
     - **Trainer Access:** Granted only when `user` holds an `ACTIVE` `TrainerAuthorization` and owns the `MentoringRelationship`.
     - **Trainee Access:** Granted only for `MentoringRelationship` records where `user` is an enrolled Trainee.

**Simultaneous Participation Matrix (All Valid Combinations):**
- `Coach` + `Talent` (manager coaching subordinate while coached by director)
- `Trainer` + `Trainee` (teaching Excel while learning Leadership)
- `Coach` + `Trainee` (manager coaching staff while learning a technical skill)
- `Trainer` + `Talent` (approved Excel trainer whose own `RoundedOverallFinalRating < 3` requires mandatory coaching)
- `Coach` + `Talent` + `Trainer` + `Trainee` (all four at the same time in separate scoped workspaces)

### 2.4 Backend Permission Catalog (`FR-PERM`)
Permissions are seeded in `core` and assigned dynamically to Roles by System Admin:

| Category | Permission Code | Capability |
| :--- | :--- | :--- |
| **System / IAM** | `USER_MANAGE` | Create, edit, deactivate users; reset local passwords |
| | `HIERARCHY_MANAGE` | Edit departments, reporting managers, and upload Phase 1 hierarchy CSV |
| | `ROLE_PERMISSION_MANAGE` | Create/modify/deactivate Roles and map permissions |
| | `SYSTEM_CONFIG_MANAGE` | Configure fiscal quarter dates and missed-session thresholds |
| | `AUDIT_LOG_VIEW` | View system-wide security & operational audit logs |
| **Skills** | `SKILL_MANAGE` | Create, update, categorize, and archive Master Skills |
| **Coaching / PMS** | `PMS_REPORT_UPLOAD` | Upload, preview, commit, and view PMS appraisal Excel batches |
| | `COACHING_ASSIGNMENT_VIEW_ALL` | View all organization-wide coaching assignments & progress |
| | `COACHING_COACH_REPLACE` | Reassign Coaches mid-quarter when a Coach leaves/changes |
| | `COACHING_REQUEST_APPROVE` | Review, approve, reject, return, or edit Skill-Development requests |
| | `COACHING_INITIATIVE_CREATE` | Create PMS-initiated skill-development coaching assignments |
| | `COACHING_REPORT_VIEW_ALL` | View all Coach/Talent session reports, missed sessions & export reports |
| | `COACHING_REQUEST_SUBMIT` | Submit individual/group skill-development coaching requests for subordinates |
| **Mentoring / HR** | `TRAINER_APPLICATION_REVIEW` | Review submitted Trainer applications and certificates; approve/reject |
| | `TRAINER_DIRECT_APPOINT` | Appoint an employee as Trainer without an application |
| | `TRAINER_STATUS_MANAGE` | Suspend, restore, or revoke Trainer authorization |
| | `MENTORING_MATCH_MANAGE` | View all learning requests and perform HR-assisted Trainer–Trainee matching |
| | `MENTORING_REPORT_VIEW_ALL` | View mentoring dashboards, Trainer stats, and export HR reports |
| **Employee Base** | `EMPLOYEE_PORTAL_ACCESS` | Access Employee Workspace (view own Coaching/Mentoring, apply as Trainer, browse/request skills) |

### 2.5 Portal & Dashboard Architecture
The React frontend renders a **single adaptive application shell** whose navigation menu and dashboard widgets adapt dynamically to the logged-in user's permissions and active participations:

1. **Unified Employee Workspace:**
   - **My Coaching (As Coach):** Assigned Talents, upcoming sessions, Daily.co join, session report submission, chat, resources, Skill-Dev request form, mark Skill-Dev complete.
   - **My Coaching (As Talent):** Assigned Coach, objectives, upcoming sessions, Daily.co join, reflection/additional report submission, chat, resources.
   - **My Mentoring (As Trainer):** Approved skills, capacity/availability settings, incoming Trainee requests, active Trainees, sessions, chat, resources.
   - **My Mentoring (As Trainee):** Apply to become a Trainer, browse/search Trainers, skill recommendations, submit learning requests, active mentoring sessions, feedback.
   - **My Pairing:** An Employee navigation item lists every relationship membership for the logged-in employee as either Mentor or Trainee, including group/class memberships and relationship status.
2. **PMS Admin Dashboard:** Report uploader + validation preview, import batch history, mandatory & skill-dev assignments table, missing-manager exception queue, Coach replacement modal, skill-dev approval queue, session report audit feed, missed-session/inactivity alerts, quarterly reports & exports.
3. **HR Admin Dashboard:** Trainer applications queue + certificate viewer, direct Trainer appointment tool, active/suspended/revoked Trainer management, HR-assisted matching queue, mentoring analytics & exports.
4. **System Admin Dashboard:** User accounts, bulk employee/hierarchy import, org tree/manager editor, dynamic Role & Permission builder, Fiscal Quarter & Threshold settings, Audit Log viewer.

---

## 3. Shared Core Platform Requirements (`FR-CORE`)

### 3.1 Authentication & Identity Phasing (`FR-CORE-AUTH`)
- **Phase 1 (Initial Release):**
  - Users authenticate using `username` (or `employeeNumber`/`email`) and `password` stored hashed with `BCrypt`.
  - Backend issues signed **JWT access tokens** containing `userId`, `employeeNumber`, and role/authority resolution.
  - System Admin creates user accounts (individually or via bulk import) with forced initial password change or temporary credentials.
  - Account states: `ACTIVE`, `LOCKED` (failed login attempts), `DISABLED` (resigned/terminated). Disabled users cannot log in; historical records remain intact.
- **Phase 2 (Active Directory Readiness):**
  - `core.users` includes `auth_provider` (`LOCAL` | `ACTIVE_DIRECTORY`) and `external_directory_id` (nullable AD GUID/DN).
  - Authentication logic sits behind an `IdentityAuthenticationProvider` interface so Bank AD integration plugs in without modifying `coaching` or `mentoring`.

### 3.2 Employee Profile & Organizational Hierarchy (`FR-CORE-ORG`)
- **Employee Identity:** Keyed uniquely by `employeeNumber` (e.g., `"123456"`), plus `fullName`, `email`, `gender`, `parentDepartment`, `department`, `job`, `position`, `employmentStatus` (`ACTIVE`, `ON_LEAVE`, `TERMINATED`), and `managerId` (nullable self-referencing FK).
- **Phase 1 Hierarchy Bootstrap (Critical Dependency):**
  - Because `Sample Performance Apresal Header.xlsx` does **not** include a manager column, System Admin (or HR) must be able to:
    1. Upload an **Employee & Hierarchy CSV/Excel** (`EmployeeNumber, FullName, Email, ParentDepartment, Department, Job, Position, ManagerEmployeeNumber`) to seed/update employees and reporting lines in bulk.
    2. Create/update departments and reassign an employee's manager via UI.
- **Hierarchy Cycle Guard:**
  - Saving a reporting change must run an ancestor traversal check and **reject any circular chain** (`A -> B -> A` or `A -> A`).
- **Position Replacement Notification / Sync:**
  - When a manager leaves or is replaced in a department/position, APID emits a hierarchy-change event so PMS can transfer active Coach assignments seamlessly.

### 3.3 Master Skill Catalog (`FR-CORE-SKILL`)
- Single shared `core.skills` repository used by **both** Skill-Development Coaching (`4.4`) and Mentoring (`5.1`, `5.4`).
- Fields: `id`, `name` (unique case-insensitive), `category` (e.g., Technical, Banking Operations, Leadership, Software Tools), `description`, `active` (boolean).
- Inactive skills remain visible on historical records/applications but cannot be selected for new requests or applications.

### 3.4 File Storage & Security (`FR-CORE-FILE`)
- All file operations go through a single `FileStorageService` interface in `common/`:
  - **Phase 1 Implementation:** `LocalFileStorageService` storing files under `/app/uploads` (mounted to `./uploads` in Docker Compose), organized in logical subfolders (`pms-reports/`, `trainer-certs/`, `coaching-resources/`, `mentoring-resources/`, `chat-attachments/`).
  - **Phase 2 Ready:** Swap to MinIO/S3 implementation without changing `coaching` or `mentoring`.
- **Security Controls:**
  - Rename every uploaded file on disk using a server-generated `UUID` while storing `originalFilename` in `core.stored_files`.
  - Validate both file extension and actual MIME / magic bytes against per-context allowlists:
    - PMS Reports: `.xlsx`
    - Trainer Certificates: `.pdf`, `.jpg`, `.jpeg`, `.png`, `.docx`
    - Learning Resources: `.pdf`, `.pptx`, `.ppt`, `.docx`, `.doc`, `.xlsx`, `.jpg`, `.png`, `.mp4` (or external URL links)
  - Enforce configurable max file sizes (default `10 MB` for certificates/chat attachments, `25 MB` for resources/Excel reports).
  - Downloads go strictly through authenticated backend endpoints verifying the requester owns or participates in the parent record (no public static `/uploads` exposure).

### 3.5 Daily.co Live Video & Attendance Engine (`FR-CORE-VIDEO`)
- Shared `VideoMeetingService` + `DailyCoClient` supporting both Coaching and Mentoring sessions:
  1. **Room Creation:** When a scheduled session is created (or when the host starts it within the active join window), APID calls the Daily.co REST API (`POST /v1/rooms`) to create a **private room** (`privacy: "private"`) with automatic expiration (`exp`) after the session window.
  2. **Meeting Tokens:** When an authorized participant clicks **"Join Live Session"**, APID validates they belong to that session and requests a short-lived Daily meeting token (`POST /v1/meeting-tokens`) setting `is_owner = true` for Coach/Trainer and `is_owner = false` for Talent/Trainee, plus `user_name` and `user_id`.
  3. **Join-Time Attendance Tracking:** Every click on "Join Live Session" immediately logs `joinedAt` on `core.video_participations` (works both locally and in production).
  4. **Coach/Trainer Attendance Confirmation:** Coach/Trainer confirms final session attendance (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`) when completing the session or submitting the session report.
  5. **Production Webhooks:** Expose a signed webhook endpoint (`POST /api/v1/core/webhooks/daily`) verifying the Daily webhook signature (`DAILY_WEBHOOK_SECRET`) to record exact `participant.joined`, `participant.left`, and `meeting.ended` durations in production.

### 3.6 Shared Chat Engine (`FR-CORE-CHAT`)
- Implemented via **REST API + Frontend Automatic Polling (every 5–10 seconds)** when a chat thread is open.
- **Strict Thread Isolation:**
  - Every `CoachingAssignment` gets its own `CoachingConversation`.
  - Every `MentoringRelationship` gets its own `MentoringConversation`.
  - Even if Person A and Person B interact in *both* Coaching and Mentoring, their chat threads and message histories remain completely separate.
- **Capabilities:**
  - Paginated message history (`cursor` or `page/size`), unread count / `lastReadAt` tracking, optional safe file attachments, and text length limits.
  - **Read-Only Archiving:** Once a coaching assignment or mentoring relationship is closed/completed, the chat thread becomes read-only (history preserved, new messages disabled).
  - Designed cleanly so WebSocket/STOMP can replace polling in a later iteration without changing the DB tables or message DTOs.

### 3.7 System Configuration & Audit Log (`FR-CORE-SYS`)
- **Configurable Settings (`core.system_configs`):**
  - Fiscal quarter start/end dates per `Year` and `Quarter`.
  - Coaching missed-session / coach-inactivity alert thresholds (configurable by PMS/System Admin later).
  - Default max concurrent Trainees per Trainer.
- **Immutable Audit Trail (`core.audit_logs`):**
  - Records `actorUserId`, `actorEmployeeNumber`, `action`, `module`, `entityType`, `entityId`, `detailsJson`, `ipAddress`, `createdAt`.
  - Captures: logins/lockouts, role & permission mutations, hierarchy updates, PMS Excel uploads/commits, Coach replacements, Skill-Dev decisions, Trainer approvals/suspensions/revocations, and sensitive report exports.

---

## 4. Coaching Module Functional Requirements (`FR-COACH`)
*Module Owner: Developer 1 (You) · Controlling Authority: PMS Department*

### 4.1 Quarterly Performance Calendar & Period Distinction (`FR-COACH-01`)
- Bank performance operates across four quarters (`Q1`, `Q2`, `Q3`, `Q4`) using rounded 1–5 performance grades (`RoundedOverallFinalRating`):
  - `1` or `2` (`RoundedOverallFinalRating < 3`): Below minimum requirement -> **Mandatory Coaching**
  - `3`: Minimum requirement met (includes averaged grades `>= 2.5000` that round to `3`)
  - `4`: Beyond expectation
  - `5`: Exceptional
- **Initial Calendar Baseline** *(stored dynamically in `core.fiscal_quarters` so exact boundary dates can be adjusted before go-live)*:

| Quarter | Baseline Months | Typical PMS Upload Window | Resulting Coaching Quarter |
| :--- | :--- | :--- | :--- |
| **Q1** | June – September | First 5–6 days of October | Q2 |
| **Q2** | October – December | First 5–6 days of January | Q3 |
| **Q3** | January – March | First 5–6 days of April | Q4 |
| **Q4** | April – May | First 5–6 days of June | Next Year Q1 |

- **Mandatory Period Separation:**
  - Even if PMS uploads the Q1 appraisal report in October (when Q2 has already started), APID stores:
    - `performanceYear` & `performanceQuarter` = `Q1` (what was graded)
    - `coachingYear` & `coachingQuarter` = `Q2` (when coaching occurs)
    - `uploadedAt` & `assignmentCreatedAt` = October timestamps

### 4.2 PMS Excel Report Integration (`FR-COACH-02`)

#### Exact Schema Mapped from `Sample Performance Apresal Header.xlsx` (21 Columns)

| # | Excel Column Header | Sample Value | Data Type | Role in APID |
|---:|---|---|---:|---|
| 1 | `EmployeeNumber` | `123456` | String | **Primary lookup key** matching `core.employees` |
| 2 | `EmployeeFullName` | `John doe` | String | Snapshot & mismatch cross-check |
| 3 | `ParentDepartment` | `Development` | String | Snapshot & Department reporting |
| 4 | `Department` | `Software Development` | String | Snapshot & Department reporting |
| 5 | `Job` | `Developer` | String | Snapshot |
| 6 | `Position` | `Junior Developer` | String | Snapshot |
| 7 | `Gender` | `Male` | String | Snapshot & demographic analytics |
| 8 | `PerformanceDocumentName` | `BOA Quarter One Performance Appraisal 2026/27` | String | Batch metadata |
| 9 | `Year` | `2026` | Integer | Period key |
| 10 | `Quarter` | `1` | Integer (1–4) | Period key |
| 11 | `GoalName` | `Coaching Module Developemt` | String | Appraisal context snapshot |
| 12 | `EvaluationStatus` | `Completed` | String | Must be validated (`Completed` expected) |
| 13 | `GoalTrackingName` | `Coaching and Feedback development` | String | Appraisal context snapshot |
| 14 | `Target` | `65.85119048` | Decimal | Appraisal context snapshot |
| 15 | `Actual` | `71.5` | Decimal | Appraisal context snapshot |
| 16 | `GoalScore` | `2.35` | Decimal | Per-goal rating out of `5.0`; averaged per employee |
| 17 | `Weight` | `25` | Decimal | Goal weight snapshot |
| 18 | `LineScore` | `0.5875` | Decimal | Weighted goal contribution snapshot |
| 19 | `OverallFinalRating` | `2.2325` | Decimal (`numeric(6,4)`) | Average of the employee's `GoalScore` rows (identical across repeated rows) |
| 20 | `RoundedOverallFinalRating` | `2` | Integer (`1–5`) | **AUTHORITATIVE GRADE** (exact half-up rounded integer used for eligibility comparison) |
| 21 | `Email` | `john.doe@email.com` | String | Snapshot & cross-check |

#### Grade Eligibility & Multi-Goal Consolidation Rule
- Each employee has multiple rows in the PMS extract (one row per goal/KPI). `OverallFinalRating` equals the arithmetic average of that employee's `GoalScore` values and is repeated identically across every row for that employee, along with `RoundedOverallFinalRating`.
$$\text{Triggers Mandatory Performance Coaching} \iff \text{RoundedOverallFinalRating} < 3$$

| Average `OverallFinalRating` | `RoundedOverallFinalRating` | New Entry? | Existing Talent Exits? |
|---:|---:|---|---|
| `1.4500` | `1` | **Yes (Mandatory)** | No (continues/new assignment) |
| `2.2325` | `2` | **Yes (Mandatory)** | No (continues/new assignment) |
| `2.6250` | `3` | **No** | **Yes (Cleared / Exits coaching)** |
| `2.9500` | `3` | **No** | **Yes (Cleared / Exits coaching)** |
| `3.1250` | `3` | No | **Yes (Cleared / Exits coaching)** |
| `4.5500` | `5` | No | **Yes (Cleared / Exits coaching)** |

#### Two-Step Upload, Validation & Commit Pipeline
1. **Prerequisite — Pre-Loaded Users & Managers Directory (`core`):**
   - PMS appraisal uploads **do not create departments, employees, or manager hierarchies**. Employees, direct managers (`core.employees.manager_id`), and login accounts (`core.users`) must already exist in the APID directory before uploading a PMS report.
2. **Step 1 — Upload & Parse Preview (`POST /api/v1/coaching/pms-reports/preview`):**
   - Store original `.xlsx`/`.csv` file via `FileStorageService` and compute file SHA-256 hash.
   - Verify all 21 required headers exist (case/trim-safe validation).
   - Verify every row's `(Year, Quarter)` matches the selected target period (or flag mismatched rows).
   - Verify `GoalScore` and `OverallFinalRating` are decimals between `0.0` and `5.0`, and `RoundedOverallFinalRating` is an integer `1..5`.
   - **Consolidate repeated goal rows** per `(EmployeeNumber, Year, Quarter)`: verify `OverallFinalRating` & `RoundedOverallFinalRating` are identical across all goal rows of the same employee and cross-check that `OverallFinalRating` matches the average of that employee's `GoalScore` values.
   - Check `EvaluationStatus`: process `Completed` rows and flag any non-`Completed` rows as warnings/errors in the preview summary.
   - Check for **already-committed `(Year, Quarter)` batch** (idempotency guard prevents accidentally duplicating a quarter's assignments!).
   - Match each unique `EmployeeNumber` against pre-existing `core.employees` (unknown employees are flagged as errors/exceptions and cannot invent org structure) and, for every employee with `RoundedOverallFinalRating < 3`, resolve their active direct manager (`Coach`) via `core.employees.manager_id`.
   - Return a detailed **Validation Preview Report**:
     - Total source goal rows, Consolidated unique employees, Mandatory Coaching count (`RoundedOverallFinalRating < 3`), Cleared count (`RoundedOverallFinalRating >= 3` for active Talents), Unknown Employees (not in directory), Non-Completed rows, Missing/Inactive Manager exceptions.
3. **Step 2 — PMS Confirm & Commit (`POST /api/v1/coaching/pms-reports/{batchId}/commit`):**
   - Executed transactionally (`@Transactional`; uses `@Async` post-validation if row count is large).
   - Saves consolidated employee ratings (`coaching.pms_performance_records`) and per-goal line snapshots (`coaching.pms_goal_lines`).
   - Evaluates active prior-quarter performance-based Talents:
     - If new `RoundedOverallFinalRating >= 3` -> updates prior assignment status to `CLEARED` and notifies Talent + prior Coach.
     - If new `RoundedOverallFinalRating < 3` -> closes/transitions prior cycle (`CONTINUED_NEXT_QUARTER`) and generates the new quarter's assignment.
   - Creates `PerformanceBasedCoachingAssignment` for all `RoundedOverallFinalRating < 3` employees (routing any employee without an active manager to `PENDING_COACH_ASSIGNMENT` exception queue instead of crashing).
   - Fires async notifications to every assigned **Talent** and **Coach**.

### 4.3 Pathway A: Performance-Based Mandatory Coaching (`FR-COACH-03`)
- **Assignment Creation & Snapshot:**
  - Captures immutable snapshots of `talentDepartment`, `talentParentDepartment`, `coachEmployeeNumber`, `coachFullName`, `triggeringRating`, `roundedRating`, `performanceYear`, `performanceQuarter`, `coachingYear`, `coachingQuarter`.
  - Future transfers or promotions never alter historical coaching records.
- **Assignment Lifecycle Statuses:**
  - `PENDING_COACH_ASSIGNMENT` (employee `RoundedOverallFinalRating < 3` has no active manager in `core.employees`; awaits PMS manual assignment)
  - `ACTIVE` (ongoing during the Coaching Quarter)
  - `AWAITING_NEXT_PMS_EVALUATION` (3-month coaching period finished; awaiting next quarterly PMS report)
  - `CLEARED` (next quarterly PMS report shows `RoundedOverallFinalRating >= 3`)
  - `CONTINUED_NEXT_QUARTER` (next quarterly PMS report is still `RoundedOverallFinalRating < 3`; replaced by a new quarterly assignment)
  - `CANCELLED` (administrative cancellation with mandatory audit reason, e.g., employee left bank)
- **Mid-Quarter Coach Replacement:**
  - If an assigned Coach leaves the bank, transfers out, or goes on long leave:
    - PMS Admin can **manually assign** a replacement Coach.
    - Or, if a new manager takes over that organizational position in `core`, PMS Admin can **transfer** the active coaching assignments to the position's new holder.
  - Every replacement writes a `CoachingCoachHistory` record (`previousCoachId`, `newCoachId`, `changedBy`, `changedAt`, `reason`) and notifies Talent, old Coach (if active), and new Coach.

### 4.4 Pathway B: Skill-Development Coaching (`FR-COACH-04`)
- **Purpose:** Allow managers (and optionally PMS) to develop new skills in employees whose rounded overall rating is satisfactory (`RoundedOverallFinalRating >= 3`), without marking them as poor performers.
- **Request Types:** Supports **Individual** (1 Talent) and **Group** (2+ Talents, e.g., 15 staff in Division One needing Advanced Excel).
- **Request Fields:**
  - `skillId` (from `core.skills`)
  - `requestType` (`INDIVIDUAL` | `GROUP`)
  - `targetEmployeeIds` (list of 1 or more employees)
  - `proposedCoachId`
  - `reason` (business need / skill gap)
  - `expectedOutcomes`
  - `proposedStartDate`, `proposedEndDate` / `proposedDurationWeeks`
  - `proposedScheduleNotes`
  - `priority` (`LOW` | `MEDIUM` | `HIGH`)
  - `supportingFileId` (optional attachment)
- **Workflow & Statuses:**
  - `DRAFT` -> `SUBMITTED` -> `UNDER_REVIEW` -> (`RETURNED_FOR_MODIFICATION` <-> `SUBMITTED`) | `REJECTED` | `APPROVED` -> `CONVERTED_TO_ASSIGNMENT` (or `CANCELLED`).
  - PMS Admin can modify `proposedCoachId`, adjust the employee list, or add reviewer notes before clicking **Approve**.
  - **Optional PMS-Initiated Skill Coaching:** PMS Admin can also create bank/division-wide Skill-Development assignments directly without waiting for a manager request.
- **Completion Authority (`Coach Decides`):**
  - Unlike Performance-Based Coaching (which exits via `RoundedOverallFinalRating >= 3`), **the assigned Coach decides when Skill-Development Coaching is completed**.
  - For **Group** assignments, the Coach can mark completion **per Talent** (`IN_PROGRESS` -> `COMPLETED`) with completion remarks, so one member falling behind does not block the rest of the group.
  - PMS Admin retains full visibility and audit control.

### 4.5 Coaching Sessions, Daily.co Live Meetings & Attendance (`FR-COACH-05`)
- **Scheduling:** Coach (or Talent if allowed by Coach settings) schedules a session (`title`, `agenda`, `scheduledStart`, `scheduledEnd`, `deliveryMode`: `DAILY_VIDEO` | `IN_PERSON` | `OTHER`).
- **Session Statuses:** `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `MISSED`, `CANCELLED`, `RESCHEDULED`.
- **Daily.co Execution:**
  - `DAILY_VIDEO` sessions auto-provision a private Daily.co room and issue scoped meeting tokens (`is_owner = true` for Coach).
  - Clicking "Join" logs `joinedAt`; Coach confirms final attendance (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`) for each Talent in the session.
- **Missed-Session & Inactivity Alerts:**
  - Background worker checks `SCHEDULED` sessions past `scheduledEnd + gracePeriod` with no attendance/completion and transitions them to `MISSED`.
  - When missed sessions or days without coaching activity exceed the **configurable threshold** (`core.system_configs`), APID flags the assignment as **At Risk** on the PMS Dashboard and notifies PMS Admin.

### 4.6 Coaching Session Reports & Talent Reflections (`FR-COACH-06`)
- Every conducted session (e.g., 12 meetings in a quarter = 12 distinct session report sets) requires documentation:
  - **Coach Session Report (Mandatory per conducted session):**
    - Topics discussed
    - Specific skills/concepts taught
    - Practical activities or exercises performed
    - Progress observed
    - Constructive feedback given
    - Recommendations / action items for next session
  - **Talent Session Report / Reflection (Supported per session + additional ad-hoc reports):**
    - Key learnings & what was understood
    - Challenges encountered
    - Questions for Coach / next steps
    - Additional feedback/notes
  - **Group Session Rule:** In group skill-development sessions, the Coach submits **one shared Coach Session Report** covering the meeting plus per-Talent attendance, while each Talent can submit their own individual Talent Reflection Report.
- All session reports flow directly to the **PMS Dashboard** so PMS can verify real coaching is taking place.

### 4.7 Coaching Privacy & Scope Rules (`FR-COACH-07`)
- **Session Reports & Attendance:** Visible to assigned Coach, participating Talent (their own entries), and authorized PMS Admins.
- **Coaching Chat:** Visible to participants in that specific `CoachingAssignment`; archived read-only upon closure. *(Not exposed as a casual feed to unrelated managers; administrative access restricted strictly to authorized formal audit permissions.)*
- **Coaching Resources:** Uploaded files/links scoped to the assignment (`Coach` can upload guides/materials; `Talent` can upload completed practice worksheets if enabled).

---

## 5. Mentoring Module Functional Requirements (`FR-MENTOR`)
*Module Owner: Developer 2 (Friend) · Controlling Authority: HR Department*

### 5.1 Trainer Application & Qualification Upload (`FR-MENTOR-01`)
- Any active employee can apply via the Employee Portal to teach one or more skills from `core.skills`.
- **Application Fields:**
  - Applicant employee identity (from logged-in user)
  - Target `skillId`(s)
  - Years of experience / expertise summary / proposed mentoring syllabus
  - Max concurrent Trainees willing to mentor (optional default from system config)
  - Weekly availability description
  - Supporting evidence files (certificates, degrees, portfolios, recommendations) stored via `FileStorageService`
- **Statuses:** `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`.

### 5.2 HR Review & Direct Trainer Appointment (`FR-MENTOR-02`)
- **Application Review Queue:**
  - HR Admin inspects applicant profile, selected skills, and securely downloads/views uploaded certificates.
  - HR Admin records `APPROVE` (creates active `TrainerAuthorization`) or `REJECT` (mandatory `rejectionReason` visible to applicant; applicant may revise and reapply later).
- **Direct Trainer Appointment (No Application Required):**
  - HR Admin can directly appoint any employee identified as having unique talent/expertise as a Trainer for chosen `skillId`(s).
  - Records: `employeeId`, `skillIds`, `appointmentReason`, `appointedByAdminId`, `appointedAt`.
  - Notifies the employee so they can customize their mentoring bio, availability, and Trainee capacity cap.

### 5.3 Trainer Status Lifecycle: Suspend & Revoke (`FR-MENTOR-03`)
HR Admin manages ongoing Trainer standing (`TrainerAuthorization`):

| Status | Meaning | Effect on Discovery & Requests | Effect on Existing Active Pairings | Reversible? |
|---|---|---|---|---|
| **`ACTIVE`** | Authorized to mentor | Visible in Browse & Recommendations; accepts new requests | Normal operation | — |
| **`SUSPENDED`** | Temporarily paused by HR (reason & date recorded) | Hidden from Browse/Recommendations; new requests blocked; `PENDING` requests auto-cancelled with notice | Active pairings flagged on HR Dashboard for **Pause** or **HR Reassignment** | **Yes** (HR can restore to `ACTIVE`) |
| **`REVOKED`** | Authorization permanently removed by HR | Hidden everywhere; new requests blocked; `PENDING` requests cancelled | Active pairings flagged on HR Dashboard for **Reassignment** or **Closure** | **No** (must re-apply or be re-appointed) |

- All historical applications, appointments, suspensions, revocations, and past mentoring sessions remain permanently preserved in audit logs and HR history.

### 5.4 Hybrid Trainer Discovery & Matching (`FR-MENTOR-04`)
APID supports **all three** discovery and matching paths concurrently:
1. **Method 1 — Direct Trainer Browsing:**
   - Employees search/filter `ACTIVE` Trainers by `skillId`, `department`, availability, and remaining Trainee capacity, inspect Trainer profiles/expertise, and send a mentoring request directly.
2. **Method 2 — Automated Skill Recommendations:**
   - Employee chooses a desired `skillId`; APID ranks matching `ACTIVE` Trainers by:
     1. Exact skill match
     2. Available capacity (`activeTraineeCount < maxTrainees`)
     3. Current workload balance (fewer active Trainees ranked higher)
     4. Optional average Trainee feedback rating
3. **Method 3 — HR-Assisted Manual Matching:**
   - Employee submits an open learning request (`"I want to learn X, please match me"`); HR Admin views matching Trainers and manually pairs the Trainee with a suitable Trainer.

### 5.5 Mentoring Requests & Capacity Rules (`FR-MENTOR-05`)
- Supports **Individual** and **Group** mentoring relationships.
- An employee can request **individual mentorship** from one active Mentor; that Mentor approves or declines the request.
- A Mentor can invite one employee to an individual pairing or invite multiple employees to a **Group/class**. Each invited employee independently approves or declines; accepted employees join the same class relationship.
- Group invitations are Mentor-initiated. Trainee-initiated requests are individual.
- Requests include the Mentor, initiator, optional skill and message, relationship type, and one response record per recipient.
- Each recipient response is `PENDING`, `ACCEPTED`, or `DECLINED`. Approval creates an active Mentor–Trainee relationship; pending and declined responses do not.
- **Capacity Guard:** System prevents assigning a new pairing if Trainer has reached `maxConcurrentTrainees` (unless HR Admin explicitly overrides).

### 5.6 Trainer–Trainee Relationships & Collaboration (`FR-MENTOR-06`)
- Accepted/matched requests create a `MentoringRelationship` (`ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`, `REASSIGNED`).
- **Shared Tools (Isolated from Coaching):**
  - Mentor and accepted trainees can open a relationship detail page that shows its participants, session history, and conversation.
  - The Mentor schedules sessions for an active relationship; sessions include a title, agenda, start/end time, delivery mode, and optional meeting link. A class relationship shares its schedule with all accepted trainees.
  - Persistent, paginated relationship chat is shared by all members of a class. Active participants can send messages; closed relationships retain read-only history.
  - Daily.co live sessions + join-time capture + Trainer attendance confirmation.
  - Scoped resource sharing (`MentoringResource`).
  - Lightweight session notes / progress milestones.
- **Closure & Feedback:**
  - Relationship ends when planned objectives/duration are reached (marked `COMPLETED` by Trainer or HR).
  - Trainee can submit an optional **Mentoring Feedback & Rating (1–5)** upon completion to help HR measure mentoring quality.

---

## 6. Notifications Matrix (`FR-NOTIF`)

All notifications write immediately to `core.notifications` (displayed in the top-bar Notification Bell with unread counter and actionable deep-link URL) and dispatch async follow-ups (e.g., future email channel) after DB commit:

| Event Trigger | Module | Recipients | Deep Link Target |
|---|---|---|---|
| PMS Excel report committed / failed | Coaching | Uploader PMS Admin | `/pms/imports/{batchId}` |
| New mandatory coaching assigned (`RoundedOverallFinalRating < 3`) | Coaching | Talent + Assigned Coach | `/coaching/assignments/{id}` |
| Mandatory coaching exited (`RoundedOverallFinalRating >= 3`) | Coaching | Talent + Prior Coach | `/coaching/assignments/{id}` |
| Mid-quarter Coach replaced | Coaching | Talent + New Coach + Old Coach | `/coaching/assignments/{id}` |
| Skill-Dev request submitted | Coaching | PMS Admins | `/pms/requests/{id}` |
| Skill-Dev request approved / rejected / returned | Coaching | Requesting Manager (+ Coach & Talents if approved) | `/coaching/requests/{id}` |
| Skill-Dev coaching marked completed by Coach | Coaching | Talent + PMS Admin | `/coaching/assignments/{id}` |
| Coaching/Mentoring session scheduled / rescheduled / cancelled | Both | All session participants | `/.../sessions/{sessionId}` |
| Upcoming session reminder (24h & 15m before) | Both | Session participants | `/.../sessions/{sessionId}` |
| Missed session / Coach inactivity alert | Coaching | Coach + PMS Admin | `/pms/alerts` |
| Overdue session report reminder (48h post-session) | Coaching | Coach / Talent | `/coaching/sessions/{sessionId}/report` |
| New chat message (optional badge/digest) | Both | Conversation counterparts | `/.../assignments/{id}#chat` |
| Trainer application submitted | Mentoring | HR Admins | `/hr/applications/{id}` |
| Trainer application approved / rejected | Mentoring | Applicant employee | `/mentoring/trainer-profile` |
| Direct HR Trainer appointment | Mentoring | Appointed employee | `/mentoring/trainer-profile` |
| Trainer suspended / revoked / restored | Mentoring | Trainer (+ active Trainees / HR if affected) | `/mentoring/relationships` |
| New Mentor invitation / trainee mentorship request | Mentoring | Invited Trainee or requested Mentor | `/mentoring?view=trainee` or `/mentoring?view=trainer` |
| Mentoring request approved / declined | Mentoring | Request initiator | `/mentoring?view=trainer` or `/mentoring?view=trainee` |

---

## 7. Reporting, Analytics & Exports (`FR-RPT`)

### 7.1 Quarterly Filtering Rules
Every PMS dashboard and report supports multi-dimensional filtering:
- `performanceYear` & `performanceQuarter` (`Q1`–`Q4`)
- `coachingYear` & `coachingQuarter` (`Q1`–`Q4`)
- `parentDepartment` & `department`
- `coachId`, `talentId`
- `assignmentType` (`PERFORMANCE_MANDATORY` | `SKILL_DEVELOPMENT`)
- `assignmentStatus`

### 7.2 PMS Coaching Reports (`FR-RPT-COACH`)
1. **Quarterly Coaching Summary Report:** Total evaluated employees, count `RoundedOverallFinalRating < 3`, mandatory assignments created, active vs. cleared vs. continued vs. pending-coach counts.
2. **Coach Activity & Workload Report:** Per-Coach table showing assigned Talents count, scheduled vs. completed vs. missed sessions, submitted Coach reports, and missing report count.
3. **Talent Progress Report:** Per-Talent history showing triggering `OverallFinalRating`, Coach, session attendance rate, Coach & Talent report counts, and current status.
4. **Department / Division Overview Report:** Performance breakdown and coaching completion/activity metrics grouped by `ParentDepartment` and `Department`.
5. **Quarter-over-Quarter Historical Performance Comparison:** Compares a Talent's `OverallFinalRating` *before* coaching (e.g., Q1 = `2.233`) against their *next* quarter rating (e.g., Q2 = `3.450`) to measure coaching effectiveness across the bank.

### 7.3 HR Mentoring Reports (`FR-RPT-MENTOR`)
1. **Trainer Pipeline & Status Report:** Submitted, approved, rejected applications; direct appointments; active, suspended, and revoked Trainers.
2. **Skill Supply vs. Demand Report:** Most requested skills vs. count of active Trainers and available capacity per skill.
3. **Mentoring Activity & Completion Report:** Active vs. completed relationships, total live sessions conducted, and average Trainee feedback ratings.

### 7.4 Export Capabilities
- Authorized PMS and HR Admins can export filtered reports to **Excel (`.xlsx`)** and **PDF (`.pdf`)**.
- Every export enforces backend permission checks, applies active query filters, and records an entry in `core.audit_logs`.

---

## 8. Conceptual Data Model & Schema Ownership

APID uses **one PostgreSQL 16 database (`apid_db`)** divided into **3 isolated schemas**:

### 8.1 `core` Schema (Shared — Joint PR Review Required)
- `core.users` (`id`, `username`, `password_hash`, `auth_provider`, `external_directory_id`, `status`, `failed_login_attempts`, `created_at`)
- `core.employees` (`id`, `user_id`, `employee_number` UNIQUE, `full_name`, `email`, `gender`, `parent_department`, `department`, `job`, `position`, `manager_id` FK->`core.employees`, `employment_status`)
- `core.departments` (`id`, `name`, `parent_department_id`, `head_employee_id`)
- `core.roles` (`id`, `name` UNIQUE, `description`, `system_protected`, `active`)
- `core.permissions` (`id`, `code` UNIQUE, `module`, `description`)
- `core.role_permissions` (`role_id`, `permission_id`)
- `core.user_roles` (`user_id`, `role_id`, `assigned_by`, `assigned_at`)
- `core.skills` (`id`, `name` UNIQUE, `category`, `description`, `active`)
- `core.fiscal_quarters` (`id`, `fiscal_year`, `quarter`, `label`, `start_date`, `end_date`, `active`)
- `core.system_configs` (`config_key` PK, `config_value`, `description`, `updated_by`, `updated_at`)
- `core.stored_files` (`id`, `storage_key`, `original_filename`, `content_type`, `size_bytes`, `module`, `uploaded_by`, `created_at`)
- `core.video_rooms` (`id`, `module`, `reference_id`, `daily_room_name`, `daily_room_url`, `expires_at`, `created_at`)
- `core.video_participations` (`id`, `video_room_id`, `user_id`, `joined_at`, `left_at`, `duration_seconds`, `attendance_source`)
- `core.notifications` (`id`, `recipient_user_id`, `module`, `event_type`, `title`, `message`, `deep_link`, `is_read`, `read_at`, `created_at`)
- `core.audit_logs` (`id`, `actor_user_id`, `module`, `action`, `entity_type`, `entity_id`, `details_json`, `created_at`)

### 8.2 `coaching` Schema (Developer 1 Ownership)
- `coaching.pms_report_batches` (`id`, `performance_document_name`, `year`, `quarter`, `file_id` FK->`core.stored_files`, `file_hash`, `status`, `total_rows`, `mandatory_count`, `error_count`, `uploaded_by`, `committed_at`)
- `coaching.pms_performance_records` (`id`, `batch_id`, `employee_id` FK->`core.employees`, `employee_number`, `year`, `quarter`, `overall_final_rating`, `rounded_overall_final_rating`, `dept_snapshot`, `parent_dept_snapshot`, UNIQUE `(employee_id, year, quarter)`)
- `coaching.pms_goal_lines` (`id`, `performance_record_id` FK->`coaching.pms_performance_records`, `goal_name`, `evaluation_status`, `goal_tracking_name`, `target`, `actual`, `goal_score`, `weight`, `line_score`)
- `coaching.skill_dev_requests` (`id`, `requested_by_user_id`, `skill_id` FK->`core.skills`, `request_type`, `proposed_coach_id`, `reason`, `expected_outcomes`, `proposed_start_date`, `proposed_end_date`, `priority`, `supporting_file_id`, `status`, `reviewed_by`, `review_notes`, `reviewed_at`)
- `coaching.skill_dev_request_employees` (`request_id`, `employee_id`)
- `coaching.coaching_assignments` (`id`, `assignment_type`, `source_pms_record_id`, `source_request_id`, `skill_id`, `coach_employee_id`, `performance_year`, `performance_quarter`, `coaching_year`, `coaching_quarter`, `status`, `is_at_risk`, `created_at`)
- `coaching.coaching_participants` (`id`, `assignment_id`, `talent_employee_id`, `dept_snapshot`, `parent_dept_snapshot`, `trigger_rating_snapshot`, `talent_status`, `completed_by_coach_at`, `completion_notes`)
- `coaching.coach_replacement_history` (`id`, `assignment_id`, `previous_coach_id`, `new_coach_id`, `reason`, `replaced_by_user_id`, `replaced_at`)
- `coaching.coaching_sessions` (`id`, `assignment_id`, `title`, `agenda`, `scheduled_start`, `scheduled_end`, `delivery_mode`, `video_room_id`, `status`, `reminded_24h`, `reminded_15m`, `report_overdue_reminded`, `created_by`)
- `coaching.coaching_session_attendance` (`id`, `session_id`, `talent_employee_id`, `attendance_status`, `joined_at`, `confirmed_by_coach_at`)
- `coaching.session_reports` (`id`, `session_id`, `author_user_id`, `author_role` (`COACH`|`TALENT`), `topics_discussed`, `skills_taught`, `activities`, `observations_or_learnings`, `feedback_or_challenges`, `next_steps`, `submitted_at`)
- `coaching.coaching_messages` (`id`, `assignment_id`, `sender_user_id`, `body`, `attachment_file_id`, `created_at`)
- `coaching.coaching_resources` (`id`, `assignment_id`, `title`, `resource_type`, `file_id`, `external_url`, `uploaded_by`, `created_at`)

### 8.3 `mentoring` Schema (Developer 2 Ownership)
- `mentoring.trainer_applications` (`id`, `applicant_employee_id` FK->`core.employees`, `expertise_summary`, `availability_notes`, `max_concurrent_trainees`, `status`, `reviewed_by`, `rejection_reason`, `submitted_at`, `reviewed_at`)
- `mentoring.trainer_application_skills` (`application_id`, `skill_id` FK->`core.skills`)
- `mentoring.trainer_qualifications` (`id`, `application_id`, `file_id` FK->`core.stored_files`, `document_type`, `description`)
- `mentoring.trainer_authorizations` (`id`, `employee_id` FK->`core.employees`, `source_type` (`APPLICATION`|`DIRECT_APPOINTMENT`), `source_application_id`, `status` (`ACTIVE`|`SUSPENDED`|`REVOKED`), `max_concurrent_trainees`, `bio`, `appointment_reason`, `authorized_by_user_id`, `status_reason`, `effective_from`, `updated_at`)
- `mentoring.trainer_skills` (`trainer_auth_id`, `skill_id` FK->`core.skills`)
- `mentoring.trainer_status_history` (`id`, `trainer_auth_id`, `previous_status`, `new_status`, `reason`, `changed_by_user_id`, `changed_at`)
- `mentoring.mentoring_requests` (`id`, `mentor_user_id`, `initiated_by_user_id`, `request_type` (`INDIVIDUAL`|`GROUP`), optional `skill_id` and `message`, `created_at`)
- `mentoring.mentoring_request_recipients` (`id`, `request_id`, `recipient_user_id`, `trainee_user_id`, `status` (`PENDING`|`ACCEPTED`|`DECLINED`), `responded_at`); group invitations have one recipient row per invited employee.
- `mentoring.mentoring_relationships` (`id`, `request_id`, `mentor_user_id`, `status` (`ACTIVE`|`PAUSED`|`COMPLETED`|`CANCELLED`|`REASSIGNED`), `started_at`, `ended_at`); one group request creates one shared class relationship.
- `mentoring.mentoring_relationship_members` (`id`, `relationship_id`, `request_recipient_id`, `mentor_user_id`, `trainee_user_id`, `status`, `joined_at`, `ended_at`); each approved trainee has a separate membership, while an individual relationship has one member.
- `mentoring.mentoring_relationship_trainees` (`relationship_id`, `trainee_employee_id`, `rating`, `feedback`, `rated_at`)
- `mentoring.mentoring_sessions` (`id`, `relationship_id`, `title`, `agenda`, `scheduled_start`, `scheduled_end`, `delivery_mode`, `meeting_url`, `status`, `notes`, `created_by_user_id`, `created_at`, `updated_at`); the relationship mentor creates sessions, and a class relationship shares them with its trainees.
- `mentoring.mentoring_session_attendance` (`id`, `session_id`, `trainee_employee_id`, `attendance_status`, `joined_at`, `confirmed_by_trainer_at`)
- `mentoring.mentoring_messages` (`id`, `relationship_id`, `sender_user_id`, `body`, `created_at`); text messages are paginated by relationship.
- `mentoring.mentoring_resources` (`id`, `relationship_id`, `title`, `resource_type`, `file_id`, `external_url`, `uploaded_by`, `created_at`)

**Database Integrity Rules:**
- Cross-module foreign keys may target `core.*` ONLY. **No foreign key or SQL join may cross between `coaching.*` and `mentoring.*`.**
- All schema changes use timestamped Flyway migrations (`VYYYYMMDDHHMM__description.sql`).

---

## 9. Caching, Background Workers & Docker Architecture

### 9.1 Redis Caching Matrix (Spring Cache)

| Cache Key / Region | Cached Data | Eviction Trigger |
|---|---|---|
| `user_permissions` | Effective permission codes per `userId` | Role edited, Role-Permission changed, User-Role changed |
| `skills_catalog` | Active `core.skills` list | Skill created, edited, or archived |
| `org_departments` | Department & Division tree | Hierarchy / Department edited or bulk uploaded |
| `fiscal_quarters` | Active & configured fiscal quarter dates | Fiscal quarter updated |

**Explicitly NEVER Cached:** `pms_performance_records`, `coaching_assignments`, `coaching_sessions`, `session_reports`, `trainer_authorizations` (suspended/revoked Trainers must be blocked instantaneously), `mentoring_requests`, `coaching_messages`, `mentoring_messages`, `notifications`.

### 9.2 Background Workers (Built-In Spring `@Scheduled` & `@Async`)
No Kafka or RabbitMQ is required. Background processing uses dedicated Spring thread pools:

1. **Scheduled Job — Upcoming Session Reminders (every 5 minutes):**
   - Queries `coaching_sessions` & `mentoring_sessions` in `SCHEDULED` status starting within 24h (where `reminded_24h = false`) or 15m (`reminded_15m = false`), creates notifications, and marks the flag true inside the transaction.
2. **Scheduled Job — Missed Session & Inactivity Monitor (hourly / daily):**
   - Marks sessions past `scheduled_end + configurable grace` without attendance/completion as `MISSED`.
   - Evaluates active coaching assignments against configurable `missed_session_alert_threshold` / `inactivity_days_threshold` and flags `is_at_risk = true` + alerts PMS Admin.
3. **Scheduled Job — Overdue Coaching Session Report Reminder (daily):**
   - Alerts Coach/Talent if a `COMPLETED` coaching session lacks a required Coach report after 48 hours.
4. **Async Task — Post-Commit Notification Dispatch (`@Async` + `@TransactionalEventListener`):**
   - Ensures notifications/future emails run outside the primary DB transaction so user actions stay fast.
5. **Async Task — Large PMS Report Import Execution:**
   - Optional async worker execution after preview confirmation when quarterly spreadsheets exceed synchronous thresholds.
6. *(Phase 2)* **Scheduled Job — Nightly Bank Active Directory Sync:**
   - Imports new employees, title/department moves, and manager hierarchy changes from AD.

### 9.3 Backend-Only Docker Setup
- `docker-compose.yml` defines **3 services**:
  - `postgres` (`postgres:16-alpine`, persistent volume `postgres_data`)
  - `redis` (`redis:7-alpine`, persistent volume `redis_data`)
  - `backend` (Spring Boot JDK 17 container built from `backend/Dockerfile`, mounting `./uploads:/app/uploads`)
- Frontend (`frontend/`) runs natively on developer workstations (`npm run dev` on port `5173`) without Docker.

---

## 10. API Conventions, Security & Non-Functional Requirements (`NFR`)

### 10.1 REST API & Response Standard
- **Prefixes:**
  - `/api/v1/core/**` (Auth, Users, Employees, Hierarchy, Roles, Permissions, Skills, Files, Video, Notifications, Config)
  - `/api/v1/coaching/**` (PMS Uploads, Assignments, Requests, Sessions, Reports, Chat, Resources, PMS Analytics)
  - `/api/v1/mentoring/**` (Applications, Trainers, Discovery, Requests, Relationships, Sessions, Chat, Resources, HR Analytics)
- **Standard Wrapper (`ApiResponse<T>`):** `{ "success": true, "message": "...", "data": ..., "timestamp": "..." }`
- **Standard Error (`ApiError`):** `{ "success": false, "errorCode": "...", "message": "...", "fieldErrors": {...}, "timestamp": "..." }`
- **OpenAPI 3 / Swagger UI:** Enabled at `/swagger-ui.html` so both developers share live API contracts.

### 10.2 Security Requirements (`NFR-SEC`)
1. **Authentication & Transport:** Passwords hashed via `BCrypt`; stateless JWT authentication; HTTPS enforced in staging/production.
2. **Backend-Enforced RBAC + Relationship Ownership:** Every endpoint uses `@PreAuthorize(...)` **plus** service-level relationship verification (`IDOR` protection—e.g., Coach A gets `403 Forbidden` if requesting Coach B's Talent or session report).
3. **KPI Confidentiality Boundary:**
   - Mentoring Trainers/Trainees **never** have access to any employee's KPI grades or coaching records.
   - Talent sees only their own ratings and coaching assignments.
   - Coaches see only assignments assigned to them `[Confirm with Senior: whether Coach sees exact numeric rating or coaching reason summary only]`.
4. **Input & File Security:** Bean Validation (`@Valid`), parameterized JPA/SQL queries (SQL injection prevention), strict file MIME/magic-byte validation, UUID storage keys, authorized-only download endpoints.
5. **Auditability:** All admin mutations, PMS uploads, Coach replacements, Trainer status transitions, and report exports are logged immutably.

### 10.3 Reliability, Performance & Maintainability (`NFR-QUAL`)
- **Idempotency:** Duplicate PMS Excel uploads cannot generate duplicate coaching assignments; scheduled reminders cannot fire twice for the same threshold.
- **Transactional Integrity:** Report commit + assignment creation + notification event publishing execute inside atomic transactions.
- **Automated Testing:** JUnit 5 + Mockito + Spring Boot Test covering all critical business rules (`RoundedOverallFinalRating < 3` entry, `>= 3` exit, multi-goal averaging verification, duplicate Excel protection, pre-existing directory validation, hierarchy cycle guard, suspended Trainer rejection, cross-module boundary rules).
- **Usability:** Responsive React + Vite + TypeScript UI supporting desktop & tablet/mobile viewports with clear validation feedback on Excel upload errors.

---

## 11. End-to-End Business Scenarios & Acceptance Criteria

- **`SC-01` Mandatory Coaching Cascade & Concurrent Participation:**
  - Pre-load employees & manager hierarchy in `core.employees`, then upload a multi-goal 21-column PMS report where **Alex** averages `2.2325` (`RoundedOverallFinalRating = 2 < 3`) and his manager **Kebede** averages `2.4000` (`RoundedOverallFinalRating = 2 < 3`), while Director **Abebe** averages `4.8000` (`RoundedOverallFinalRating = 5`).
  - **Expected:** System collapses repeated goal rows per employee and creates two Q2 mandatory assignments: `Kebede -> Alex` and `Abebe -> Kebede`. Kebede logs into one Employee Workspace and manages Alex under *My Coaching (As Coach)* while attending sessions under Abebe in *My Coaching (As Talent)*.
- **`SC-02` Rounded Boundary Precision (`2.48 -> 2` vs `2.625 -> 3` vs `2.95 -> 3`):**
  - On initial upload: employee with average `2.4800` (`RoundedOverallFinalRating = 2 < 3`) enters mandatory coaching; employees with average `2.6250` or `2.9500` (`RoundedOverallFinalRating = 3 >= 3`) do **NOT** enter mandatory coaching.
  - On next quarter upload for an active Talent: `RoundedOverallFinalRating = 2` keeps Talent in coaching (`CONTINUED_NEXT_QUARTER`); `RoundedOverallFinalRating = 3` (or higher) sets prior assignment to `CLEARED` and removes Talent from mandatory coaching.
- **`SC-03` Idempotent Re-Upload:**
  - Re-uploading the exact Q1 file is rejected/blocked from committing duplicate assignments.
- **`SC-04` Mid-Quarter Coach Replacement:**
  - Kebede leaves Division One in November; PMS replaces Kebede with new Division Manager **Sara**. Existing Q2 session reports written by Kebede remain intact under Kebede's name, `coaching.coach_replacement_history` records the transfer, and Sara sees Alex immediately.
- **`SC-05` Group Skill-Development Coaching & Coach Completion:**
  - Manager submits a group request for 15 staff (`RoundedOverallFinalRating >= 3`) in `Advanced Excel` -> PMS approves -> Coach holds 4 Daily.co sessions, submits 1 Coach report per group session with individual attendance -> Coach marks 13 Talents `COMPLETED` while keeping 2 absentees `IN_PROGRESS`.
- **`SC-06` 12-Session Reporting & PMS Oversight:**
  - Coach and Talent conduct 12 sessions across Q2 -> 12 Coach reports + Talent reflections are recorded and filterable by Q1/Q2 under PMS Dashboard. If 3 consecutive sessions are missed, assignment flags `At Risk`.
- **`SC-07` Trainer Application, Suspension & Revocation:**
  - Employee applies with certificate -> HR approves -> Trainee requests via Recommendation -> 1 session held -> HR suspends Trainer -> Trainer immediately disappears from Browse/Recommendations, pending unaccepted requests cancel, and HR Dashboard highlights the active pairing for reassignment while preserving all past records.
- **`SC-08` Dynamic Four-Hat User:**
  - One employee simultaneously holds active `Coach`, `Talent`, `Trainer`, and `Trainee` assignments across isolated chats, schedules, resources, and Daily.co sessions without permission leakage.

---

## 12. Remaining Confirmation Items & Implementation Roadmap

### 12.1 Final Sign-Off Items (Configurable / Quick Confirmation Before Production)
1. **Exact Q1–Q4 Calendar Dates:** Confirm whether Q1 is `Jun–Sep` / Q4 `Apr–May` or equal 3-month quarters (handled via configurable `core.fiscal_quarters`).
2. **Default Missed-Session / Inactivity Alert Numbers:** Confirm initial default values (configurable via `core.system_configs`).
3. **Coach KPI Visibility Granularity:** Confirm whether Coach sees Talent's exact `OverallFinalRating` (`2.233`) & `GoalScore` breakdown or only that mandatory coaching was triggered.
4. **Mentoring Direct-Browse Approval:** Confirm whether Trainer alone accepts self-browse requests or HR co-approves.

### 12.2 Phased Build Plan (Two Developers)
1. **Milestone 1 — Shared Core Foundation (Joint):** Scaffold Spring Boot + Flyway + PostgreSQL + Redis + React/Vite shell, JWT auth, Dynamic RBAC, Employee/Hierarchy CSV import, Master Skills, File Storage, Daily.co client, Notifications.
2. **Milestone 2 — Parallel Module Implementation:**
   - **Developer 1 (`coaching/`):** PMS Excel Preview/Commit -> Mandatory Coaching & Replacement -> Skill-Dev Requests -> Sessions & Daily.co -> Session Reports -> PMS Dashboard & Exports.
   - **Developer 2 (`mentoring/`):** Trainer Application & Cert Upload -> HR Review & Direct Appointment -> Suspend/Revoke -> Discovery/Matching -> Mentoring Relationships & Sessions -> HR Dashboard & Exports.
3. **Milestone 3 — Joint Integration & Testing:** Cross-module multi-role scenario testing (`SC-01` through `SC-08`), ArchUnit/boundary verification, security/IDOR checks, UAT with PMS & HR.
4. **Phase 2 (Post-v1.0):** Bank Active Directory SSO + nightly hierarchy sync, MinIO/S3 storage swap, WebSocket chat upgrade, external email alerts.

