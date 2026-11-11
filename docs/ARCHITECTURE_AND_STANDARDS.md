# APID — Architecture & Practical Engineering Standards

This document translates enterprise software standards into **clear, practical rules** that two developers (Coaching Lead + Mentoring Lead) can follow comfortably without unnecessary complexity.

---

## 1. Standards Filter: What We Adopt vs. Skip for Version 1.0

| Practice / Tool | Decision | Reason |
| :--- | :--- | :--- |
| **Modular Monolith (`common`, `core`, `coaching`, `mentoring`)** | **ADOPT** | One deployable backend, clear business separation, easy for two developers to integrate. |
| **5-Folder Module Pattern (`controller`, `service`, `repository`, `entity`, `dto`)** | **ADOPT** | Standard Spring Boot layout; avoids excessive Clean Architecture/DDD boilerplate while keeping clean separation. |
| **PostgreSQL + 3 Schemas (`core`, `coaching`, `mentoring`)** | **ADOPT** | One database, strict module data ownership, zero table-name collisions. |
| **Timestamped Flyway Migrations** | **ADOPT** | Format `VYYYYMMDDHHMM__description.sql` prevents version-number collisions across branches. |
| **REST + `@Valid` + OpenAPI/Swagger** | **ADOPT** | Clear API contracts so Coaching & Mentoring frontend/backend work in parallel. |
| **Spring Security + JWT + `@PreAuthorize`** | **ADOPT** | Backend enforces permissions and ownership on every endpoint. |
| **Redis Caching (`@Cacheable` / `@CacheEvict`)** | **ADOPT (Selective)** | Cache permissions, skills, hierarchy, and quarter config; never cache live assignments, grades, or trainer status. |
| **Spring `@Scheduled` + `@Async` Workers** | **ADOPT** | Handles reminders, missed-session detection, and async PMS processing without Kafka/RabbitMQ. |
| **Docker Compose (PostgreSQL + Redis + Backend)** | **ADOPT (Backend Only)** | Identical local DB/Redis/runtime across laptops; React/Vite runs locally with `npm run dev`. |
| **JUnit 5 + Mockito + Spring Boot Test** | **ADOPT** | Mandatory tests for core rules (`< 3.0` entry, `> 3.0` exit, duplicate Excel protection, suspended trainer blocking). |
| **Git Feature Branches + PR Review** | **ADOPT** | `main` stays working; PR review required when touching `core/` or `common/`. |
| *Kubernetes, Kafka, SonarQube, Checkstyle, Testcontainers, Playwright, OpenTelemetry, strict 4-layer DDD* | **DEFER / SKIP** | Too heavy for a two-developer initial release; revisit only if future enterprise scale requires them. |

---

## 2. Module Ownership & Communication Rules

| Package / Area | Primary Owner | What Goes Inside |
| :--- | :--- | :--- |
| `backend/.../common/` | **Joint** | `GlobalExceptionHandler`, standard `ApiResponse`, pagination DTOs, Redis config, Async/Scheduler config, `FileStorageService`, `DailyCoClient` |
| `backend/.../core/` | **Joint** | Auth (JWT + Phase 2 AD-ready user), Employees & Org Hierarchy, Dynamic RBAC (`Role`, `Permission`), Master `Skill` catalog, `Notification`, `VideoSession`, `StoredFile`, `AuditLog`, `SystemConfig` |
| `backend/.../coaching/` | **Developer 1 (You)** | PMS Excel upload & parsing, `PerformanceRecord`, `CoachingAssignment`, `CoachingRequest`, `CoachingSession`, `SessionReport`, `CoachingMessage`, `CoachingResource`, PMS dashboards & exports |
| `backend/.../mentoring/` | **Developer 2 (Friend)** | `TrainerApplication`, `TrainerQualification`, `TrainerAuthorization`, discovery & matching, `MentoringRequest`, `MentoringRelationship`, `MentoringSession`, `MentoringMessage`, `MentoringResource`, HR dashboards |
| `frontend/src/app` & `shared/` | **Joint** | App router, auth provider, unified adaptive layout/sidebar, reusable UI components, Axios client |
| `frontend/src/features/admin` | **Joint** | System Admin pages (Users, Dynamic Roles/Permissions, Org Hierarchy bootstrap, Fiscal Quarters) |
| `frontend/src/features/coaching` | **Developer 1 (You)** | Coach, Talent, and PMS Admin pages & API hooks |
| `frontend/src/features/mentoring` | **Developer 2 (Friend)** | Trainer, Trainee, and HR Admin pages & API hooks |

### Non-Negotiable Boundary Rules
1. **`coaching` and `mentoring` must NEVER import each other's `repository`, `entity`, or `service` classes.**
2. Both modules talk **only** to `core/` services (e.g., `EmployeeQueryService`, `SkillService`, `NotificationService`, `VideoMeetingService`, `FileStorageService`) and `common/`.
3. A module may **only** create foreign keys to `core` tables—never from `coaching` to `mentoring` or `mentoring` to `coaching`.
4. Neither developer edits `core/` or `common/` without reviewing with the other developer in a PR.

---

## 3. Database & Flyway Migration Rules

- **Database:** Single PostgreSQL 16 database (`apid_db`) with 3 schemas:
  - `core` (shared foundation)
  - `coaching` (Developer 1)
  - `mentoring` (Developer 2)
- **Migration Filename Standard:**
  Always use `VYYYYMMDDHHMM__short_description.sql` (local timestamp down to the minute), for example:
  - `V202611120900__init_core_tables.sql`
  - `V202611131415__create_coaching_tables.sql`
  - `V202611131430__create_mentoring_tables.sql`
- **Never edit a migration file once it has been merged to `main`.** Always create a new timestamped migration to alter a table.

---

## 4. Docker, Caching & Background Worker Guidelines

### Docker (Backend & Infrastructure Only)
- `docker-compose.yml` runs **`postgres`**, **`redis`**, and **`backend`** (Java 17).
- File uploads persist to `./uploads` mapped to `/app/uploads` inside `backend` behind the `FileStorageService` interface (ready to swap to MinIO/S3 later).
- Frontend runs directly via `npm run dev` on port `5173`.

### Redis Caching Rules
- **Cache:** User permission sets, Master `Skill` list, Department/Hierarchy lookups, Fiscal Quarter config.
- **Evict on write:** Every admin mutation affecting permissions, skills, or hierarchy must trigger `@CacheEvict`.
- **Never cache:** PMS grades, Coaching assignments, Session reports, Chat messages, Notifications, or Trainer authorization/suspension checks.

### Background Workers (`@Scheduled` + `@Async`)
- **Scheduled jobs (`@Scheduled`):**
  1. Session reminder job (24h & 15m before Daily.co sessions; uses boolean reminder-sent flags to prevent duplicates).
  2. Missed session & inactivity check job (marks expired unstarted sessions `MISSED` and checks configurable inactivity thresholds).
  3. Overdue session report reminder job (alerts Coach/Talent if a completed session has no report after 48h).
- **Async tasks (`@Async`):**
  1. Heavy PMS Excel processing after fast initial schema validation.
  2. Notification dispatch after DB commit (`@TransactionalEventListener`).

---

## 5. Git & Pull Request Workflow

- **`main` is protected:** No direct commits to `main`.
- **Branch naming:**
  - `feature/core-<topic>`
  - `feature/coaching-<topic>`
  - `feature/mentoring-<topic>`
  - `fix/<module>-<bug>`
- **Conventional commit messages:**
  - `feat(coaching): implement pms excel parser`
  - `feat(mentoring): add trainer suspension lifecycle`
  - `fix(core): guard against circular manager hierarchy`
- **PR checklist before merging:**
  1. Pull latest `main` and resolve conflicts locally.
  2. Verify backend compiles and unit/integration tests pass.
  3. Verify `coaching` does not import `mentoring` (and vice versa).
  4. Review by teammate if any `core/`, `common/`, or migration file changed.

