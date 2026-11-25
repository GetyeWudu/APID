-- Bank of Abyssinia APID Organization Clean-up
-- Purge technical LDAP service accounts (svc_apid_ldap) from employee and user tables
DELETE FROM core.employees 
WHERE employee_number ILIKE 'svc_%' 
   OR employee_number ILIKE 'svc-%'
   OR employee_number = 'svc_apid_ldap';

DELETE FROM core.users 
WHERE username ILIKE 'svc_%' 
   OR username ILIKE 'svc-%'
   OR username = 'svc_apid_ldap';
