export interface UserProfile {
  id: number;
  username: string;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresInMs: number;
  user: UserProfile;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

