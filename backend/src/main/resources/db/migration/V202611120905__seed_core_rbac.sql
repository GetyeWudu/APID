-- Seed 19 granular permissions (FR-PERM) and 4 default roles (no hardcoded users/passwords)

INSERT INTO core.permissions (code, module, description) VALUES
    ('USER_MANAGE',                 'SYSTEM',    'Create, edit, deactivate users; reset local passwords'),
    ('HIERARCHY_MANAGE',            'SYSTEM',    'Edit departments, reporting managers, and upload Phase 1 hierarchy CSV'),
    ('ROLE_PERMISSION_MANAGE',      'SYSTEM',    'Create/modify/deactivate Roles and map permissions'),
    ('SYSTEM_CONFIG_MANAGE',        'SYSTEM',    'Configure fiscal quarter dates and missed-session thresholds'),
    ('AUDIT_LOG_VIEW',              'SYSTEM',    'View system-wide security & operational audit logs'),
    ('SKILL_MANAGE',                'SKILL',     'Create, update, categorize, and archive Master Skills'),
    ('PMS_REPORT_UPLOAD',           'COACHING',  'Upload, preview, commit, and view PMS appraisal Excel batches'),
    ('COACHING_ASSIGNMENT_VIEW_ALL','COACHING',  'View all organization-wide coaching assignments & progress'),
    ('COACHING_COACH_REPLACE',      'COACHING',  'Reassign Coaches mid-quarter when a Coach leaves/changes'),
    ('COACHING_REQUEST_APPROVE',    'COACHING',  'Review, approve, reject, return, or edit Skill-Development requests'),
    ('COACHING_INITIATIVE_CREATE',  'COACHING',  'Create PMS-initiated skill-development coaching assignments'),
    ('COACHING_REPORT_VIEW_ALL',    'COACHING',  'View all Coach/Talent session reports, missed sessions & export reports'),
    ('COACHING_REQUEST_SUBMIT',     'COACHING',  'Submit individual/group skill-development coaching requests for subordinates'),
    ('TRAINER_APPLICATION_REVIEW',  'MENTORING', 'Review submitted Trainer applications and certificates; approve/reject'),
    ('TRAINER_DIRECT_APPOINT',      'MENTORING', 'Appoint an employee as Trainer without an application'),
    ('TRAINER_STATUS_MANAGE',       'MENTORING', 'Suspend, restore, or revoke Trainer authorization'),
    ('MENTORING_MATCH_MANAGE',      'MENTORING', 'View all learning requests and perform HR-assisted Trainer-Trainee matching'),
    ('MENTORING_REPORT_VIEW_ALL',   'MENTORING', 'View mentoring dashboards, Trainer stats, and export HR reports'),
    ('EMPLOYEE_PORTAL_ACCESS',      'EMPLOYEE',  'Access Employee Workspace (Coaching/Mentoring/Trainer applications/skills)');

INSERT INTO core.roles (name, description, system_protected, active) VALUES
    ('Super Admin', 'Full platform administration and security governance', TRUE, TRUE),
    ('PMS Admin',   'Performance Management System administrator owning Coaching oversight', FALSE, TRUE),
    ('HR Admin',    'Human Resources administrator owning Mentoring and Trainer governance', FALSE, TRUE),
    ('Employee',    'Base employee portal participation role', FALSE, TRUE);

-- Super Admin gets all 19 permissions
INSERT INTO core.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM core.roles r, core.permissions p
WHERE r.name = 'Super Admin';

-- PMS Admin permissions
INSERT INTO core.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM core.roles r
JOIN core.permissions p ON p.code IN (
    'PMS_REPORT_UPLOAD',
    'COACHING_ASSIGNMENT_VIEW_ALL',
    'COACHING_COACH_REPLACE',
    'COACHING_REQUEST_APPROVE',
    'COACHING_INITIATIVE_CREATE',
    'COACHING_REPORT_VIEW_ALL',
    'EMPLOYEE_PORTAL_ACCESS'
)
WHERE r.name = 'PMS Admin';

-- HR Admin permissions
INSERT INTO core.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM core.roles r
JOIN core.permissions p ON p.code IN (
    'TRAINER_APPLICATION_REVIEW',
    'TRAINER_DIRECT_APPOINT',
    'TRAINER_STATUS_MANAGE',
    'MENTORING_MATCH_MANAGE',
    'MENTORING_REPORT_VIEW_ALL',
    'SKILL_MANAGE',
    'EMPLOYEE_PORTAL_ACCESS'
)
WHERE r.name = 'HR Admin';

-- Employee permissions
INSERT INTO core.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM core.roles r
JOIN core.permissions p ON p.code IN (
    'EMPLOYEE_PORTAL_ACCESS',
    'COACHING_REQUEST_SUBMIT'
)
WHERE r.name = 'Employee';

