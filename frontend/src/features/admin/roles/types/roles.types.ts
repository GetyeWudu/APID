export interface PermissionItem {
  id: number;
  code: string;
  module: string;
  description: string;
}

export interface RoleItem {
  id: number;
  name: string;
  description: string | null;
  systemProtected: boolean;
  active: boolean;
  permissions: string[];
  activeUserCount: number;
}

export interface CreateRolePayload {
  name: string;
  description?: string;
  permissionCodes: string[];
}

export interface UpdateRolePayload {
  name: string;
  description?: string;
  active: boolean;
}

