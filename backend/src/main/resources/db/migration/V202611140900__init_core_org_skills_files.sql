-- Core Phase 3: Organizational Hierarchy, Shared Master Skill Catalog & Stored File Metadata

CREATE TABLE core.departments (
    id                   BIGSERIAL PRIMARY KEY,
    code                 VARCHAR(60),
    name                 VARCHAR(150) NOT NULL,
    parent_department_id BIGINT       REFERENCES core.departments(id) ON DELETE RESTRICT,
    head_employee_id     BIGINT,
    active               BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_departments_not_self_parent CHECK (parent_department_id IS NULL OR parent_department_id <> id)
);

CREATE UNIQUE INDEX uq_departments_code_lower
    ON core.departments (LOWER(code))
    WHERE code IS NOT NULL;

CREATE UNIQUE INDEX uq_departments_name_parent_lower
    ON core.departments (LOWER(name), COALESCE(parent_department_id, 0));

CREATE INDEX idx_departments_parent_id ON core.departments (parent_department_id);

CREATE TABLE core.employees (
    id                     BIGSERIAL PRIMARY KEY,
    user_id                BIGINT       UNIQUE REFERENCES core.users(id) ON DELETE SET NULL,
    employee_number        VARCHAR(60)  NOT NULL,
    full_name              VARCHAR(200) NOT NULL,
    email                  VARCHAR(200),
    gender                 VARCHAR(30),
    department_id          BIGINT       REFERENCES core.departments(id) ON DELETE RESTRICT,
    parent_department_name VARCHAR(150),
    department_name        VARCHAR(150),
    job                    VARCHAR(150),
    position               VARCHAR(150),
    manager_id             BIGINT       REFERENCES core.employees(id) ON DELETE SET NULL,
    employment_status      VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_employees_not_self_manager CHECK (manager_id IS NULL OR manager_id <> id)
);

CREATE UNIQUE INDEX uq_employees_number_lower ON core.employees (LOWER(employee_number));
CREATE UNIQUE INDEX uq_employees_email_lower ON core.employees (LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_employees_manager_id ON core.employees (manager_id);
CREATE INDEX idx_employees_department_id ON core.employees (department_id);
CREATE INDEX idx_employees_status ON core.employees (employment_status);
CREATE INDEX idx_employees_full_name_lower ON core.employees (LOWER(full_name));

ALTER TABLE core.departments
    ADD CONSTRAINT fk_departments_head_employee
        FOREIGN KEY (head_employee_id) REFERENCES core.employees(id) ON DELETE SET NULL;

CREATE TABLE core.skills (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    category    VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_skills_name_lower ON core.skills (LOWER(name));
CREATE INDEX idx_skills_category_lower ON core.skills (LOWER(category));
CREATE INDEX idx_skills_active ON core.skills (active);

INSERT INTO core.skills (name, category, description, active) VALUES
    ('Advanced Excel & Financial Modeling', 'Technical', 'Pivot tables, formulas, automation, and financial data analysis', TRUE),
    ('Credit Risk & Loan Assessment',       'Banking Operations', 'Evaluating creditworthiness, risk mitigation, and portfolio quality', TRUE),
    ('Customer Service Excellence',         'Customer Relations', 'Service standards, complaint resolution, and branch client care', TRUE),
    ('Leadership & Performance Coaching',   'Leadership', 'Structuring development plans, active listening, and constructive feedback', TRUE),
    ('Data Analytics & Power BI',           'Technical', 'Dashboards, KPI visualization, and operational reporting', TRUE),
    ('Java & Spring Boot Development',      'Software Engineering', 'Building modular, secure enterprise backend services', TRUE)
ON CONFLICT DO NOTHING;

CREATE TABLE core.stored_files (
    id                  BIGSERIAL PRIMARY KEY,
    storage_key         VARCHAR(255) NOT NULL UNIQUE,
    original_filename   VARCHAR(255) NOT NULL,
    content_type        VARCHAR(150) NOT NULL,
    size_bytes          BIGINT       NOT NULL CHECK (size_bytes >= 0),
    sha256_hash         VARCHAR(64)  NOT NULL,
    module              VARCHAR(40)  NOT NULL,
    purpose             VARCHAR(60)  NOT NULL,
    uploaded_by_user_id BIGINT       NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    deleted             BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stored_files_uploaded_by ON core.stored_files (uploaded_by_user_id);
CREATE INDEX idx_stored_files_module_purpose ON core.stored_files (module, purpose);

