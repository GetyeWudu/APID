-- Initial schema isolation for APID modular monolith
-- core: Shared platform (users, roles, hierarchy, skills, notifications, files, video, audit)
-- coaching: PMS-owned Coaching module
-- mentoring: HR-owned Mentoring module

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS coaching;
CREATE SCHEMA IF NOT EXISTS mentoring;

