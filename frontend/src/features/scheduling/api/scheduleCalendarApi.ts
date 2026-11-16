import { apiClient, ApiResponse } from '../../../shared/api/apiClient';

export type ScheduleParticipationRole = 'COACH' | 'TALENT' | 'MENTOR' | 'MENTEE';
export type ScheduleEventStatus = 'CONFIRMED' | 'RESCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface ScheduleParticipantDto {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeNumber: string;
  participationRole: ScheduleParticipationRole;
  reservationStatus: 'ACTIVE' | 'RELEASED';
}

export interface ScheduleEventDto {
  id: number;
  sourceModule: string; // 'COACHING' | 'MENTORING'
  sourceSessionId: number;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
  status: ScheduleEventStatus;
  meetingMode?: string;
  meetingLocation?: string;
  videoCallUrl?: string;
  myRole?: ScheduleParticipationRole;
  participants: ScheduleParticipantDto[];
}

export const scheduleCalendarApi = {
  async getMyCalendar(params?: { from?: string; to?: string }): Promise<ScheduleEventDto[]> {
    const res = await apiClient.get<ApiResponse<ScheduleEventDto[]>>('/schedule/my-calendar', {
      params,
    });
    return res.data.data;
  },
};
