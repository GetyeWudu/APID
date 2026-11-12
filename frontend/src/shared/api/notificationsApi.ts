import { apiClient, type ApiResponse } from './apiClient';

export type NotificationModuleType = 'COACHING' | 'MENTORING' | 'SYSTEM';

export interface NotificationItem {
  id: number;
  module: NotificationModuleType;
  eventType: string;
  title: string;
  message: string;
  deepLink: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: NotificationItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  unreadCount: number;
}

export const notificationsApi = {
  async list(params?: {
    page?: number;
    size?: number;
    unreadOnly?: boolean;
  }): Promise<NotificationPage> {
    const res = await apiClient.get<ApiResponse<NotificationPage>>('/core/notifications', {
      params: {
        page: params?.page ?? 0,
        size: params?.size ?? 20,
        unreadOnly: params?.unreadOnly ?? false,
      },
    });
    return res.data.data;
  },

  async markRead(id: number): Promise<NotificationItem> {
    const res = await apiClient.patch<ApiResponse<NotificationItem>>(
      `/core/notifications/${id}/read`
    );
    return res.data.data;
  },

  async markAllRead(): Promise<{ updatedCount: number }> {
    const res = await apiClient.post<ApiResponse<{ updatedCount: number }>>(
      '/core/notifications/read-all'
    );
    return res.data.data;
  },
};

