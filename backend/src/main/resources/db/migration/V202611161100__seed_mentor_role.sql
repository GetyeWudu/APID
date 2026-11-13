INSERT INTO core.roles (name, description, system_protected, active)
VALUES ('Mentor', 'Approved employee mentor role', FALSE, TRUE)
ON CONFLICT DO NOTHING;
