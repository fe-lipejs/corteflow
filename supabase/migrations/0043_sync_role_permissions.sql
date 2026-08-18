-- Migration 0043: Sincronizar todas as permissões para owner e admin

INSERT INTO sys_role_permissions (role, permission_key)
SELECT 'owner'::varchar, key FROM sys_permissions
ON CONFLICT (role, permission_key) DO NOTHING;

INSERT INTO sys_role_permissions (role, permission_key)
SELECT 'admin'::varchar, key FROM sys_permissions
ON CONFLICT (role, permission_key) DO NOTHING;
