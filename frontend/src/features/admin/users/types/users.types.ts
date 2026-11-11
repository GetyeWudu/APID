export type UserStatus = 'ACTIVE' | 'DISABLED' | 'ADMIN_LOCKED';

export interface RoleSummary {
  id: number;
  name: string;
  systemProtected: boolean;
}

export interface AdminUser {
  id: number;
  username: string;
  authProvider: string;
  status: UserStatus;
  temporarilyLocked: boolean;
  lockedUntil: string | null;
  failedLoginAttempts: number;
  mustChangePassword: boolean;
  roles: RoleSummary[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface PageResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CreateUserPayload {
  username: string;
  temporaryPassword?: string;
  roleIds: number[];
}

export interface CreateUserResult {
  user: AdminUser;
  temporaryPassword: string;
}

export interface PasswordResetResult {
  userId: number;
  username: string;
  temporaryPassword: string;
}

