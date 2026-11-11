# APID — Abyssinia Personal Intelligence and Development

Monorepo for **APID** (Bank of Abyssinia), an internal employee development and knowledge-sharing platform featuring two core business modules:
- **Coaching Module** (controlled by PMS): Quarterly performance-based mandatory coaching (`OverallFinalRating < 3.0`), manager-requested skill-development coaching (`>= 3.0`), Daily.co sessions, session reporting, and PMS oversight.
- **Mentoring Module** (controlled by HR): Trainer applications & document review, direct Trainer appointments, suspension/revocation lifecycle, skill discovery & matching, and mentoring collaboration.

---

## Repository Layout

```text
APID/
├── docs/
│   ├── SRS.md                          # Complete Software Requirements Specification
│   └── ARCHITECTURE_AND_STANDARDS.md   # Practical team standards, Docker, caching & Git workflow
├── backend/                            # Java 17 / Spring Boot modular monolith
│   ├── Dockerfile
│   └── src/
│       ├── main/java/com/boa/apid/
│       │   ├── common/                 # Global errors, configs (Redis, async, Daily.co, file storage)
│       │   ├── core/                   # Shared Auth, RBAC, Hierarchy, Skills, Notifications, Files
│       │   ├── coaching/               # Coaching module (Developer 1)
│       │   └── mentoring/              # Mentoring module (Developer 2)
│       ├── main/resources/db/migration/
│       └── test/java/com/boa/apid/
├── frontend/                           # React + Vite + TypeScript (runs locally, not in Docker)
│   └── src/
│       ├── app/                        # Router, auth provider, shared dashboard shell
│       ├── shared/                     # Reusable UI components & API client
│       └── features/                   # admin, coaching, mentoring feature modules
├── uploads/                            # Mounted to /app/uploads in backend Docker container
├── docker-compose.yml                  # PostgreSQL + Redis + Backend API
└── .env.example                        # Environment variable template
```

---

## Quick Start (Backend & Infrastructure via Docker)

1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```
2. **During active backend development** (run DB + Redis in Docker, run Spring Boot from IDE):
   ```bash
   docker compose up -d postgres redis
   ```
3. **Full containerized backend** (PostgreSQL + Redis + Spring Boot API):
   ```bash
   docker compose up --build -d
   ```
4. **Frontend (runs directly on your machine, not in Docker):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## Documentation
- Read the complete system specification in [docs/SRS.md](docs/SRS.md).
- Read the team folder, Docker, caching, worker, and Git rules in [docs/ARCHITECTURE_AND_STANDARDS.md](docs/ARCHITECTURE_AND_STANDARDS.md).

