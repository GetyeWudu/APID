-- Bank of Abyssinia APID System Configuration
-- Add coaching.ad_sync_interval with default '7_DAYS' to replace legacy 30-minute hardcoding
INSERT INTO core.system_configs (
    config_key,
    config_value,
    value_type,
    description,
    is_public,
    created_at,
    updated_at
) VALUES (
    'coaching.ad_sync_interval',
    '7_DAYS',
    'STRING',
    'Active Directory (AD DS) background synchronization interval. Predefined: 7_DAYS (7 days), 1_DAY (1 day), 12_HOURS (12 hours), 1_HOUR (1 hour)',
    true,
    NOW(),
    NOW()
) ON CONFLICT (config_key) DO NOTHING;
