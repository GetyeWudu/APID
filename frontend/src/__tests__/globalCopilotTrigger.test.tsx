import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApidCopilotProvider, useApidCopilot } from '../features/coaching/components/ai/ApidCopilotContext';
import { AppLayout } from '../shared/components/AppLayout';
import * as AuthContextModule from '../app/AuthContext';

// Mock coreConfigApi
vi.mock('../features/admin/config/api/coreConfigApi', () => ({
  coreConfigApi: {
    getActiveConfig: vi.fn().mockResolvedValue({
      activeQuarter: {
        quarterId: 2,
        fiscalYear: '2026/27',
        quarter: 2,
        label: 'FY 2026/27 · Q2',
      },
    }),
  },
}));

// Mock coaching AI API so drawer does not fail
vi.mock('../features/coaching/ai/api/pmsCoachingAiApi', () => ({
  pmsCoachingAiApi: {
    generateBriefing: vi.fn().mockResolvedValue({
      headline: 'Mock Briefing',
      markdownText: 'Briefing text',
    }),
    askCopilot: vi.fn().mockResolvedValue({
      response: 'Mock Copilot Response',
      modelUsed: 'qwen3:8b (CUDA GPU)',
      inferenceSeconds: 1.2,
      actionCards: [],
    }),
  },
}));

// Mock workspace APIs
vi.mock('../features/workspace/api/workspaceDashboardApi', () => ({
  workspaceLiveApi: {
    loadMyIdentity: vi.fn().mockResolvedValue({ directReports: [] }),
  },
}));

vi.mock('../features/mentoring/api/mentoringTrainerApi', () => ({
  mentoringTrainerApi: {
    hasMentorWorkspaceAccess: vi.fn().mockResolvedValue(false),
  },
}));

describe('Global Omnipresent Copilot Trigger (Pattern 1 Industry Standard)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        username: 'admin',
        roles: ['Super Admin'],
        permissions: ['EMPLOYEE_PORTAL_ACCESS', 'USER_MANAGE'],
        mustChangePassword: false,
      },
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshProfile: vi.fn(),
      hasPermission: () => true,
      hasAnyPermission: () => true,
    });
  });

  it('renders the illuminated "Ask Copilot" button with Ctrl+K badge in the top navigation bar', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ApidCopilotProvider>
            <AppLayout>
              <div>Dashboard Page Content</div>
            </AppLayout>
          </ApidCopilotProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Verify topbar button is rendered
    const copilotBtn = screen.getByRole('button', { name: /Ask APID Intelligence Copilot/i });
    expect(copilotBtn).toBeInTheDocument();
    expect(copilotBtn).toHaveClass('boa-topbar-copilot-btn');
    expect(screen.getByText('Ask Copilot')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('toggles the APID Copilot drawer when topbar button is clicked', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ApidCopilotProvider>
            <AppLayout>
              <div>Dashboard Page Content</div>
            </AppLayout>
          </ApidCopilotProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    const copilotBtn = screen.getByRole('button', { name: /Ask APID Intelligence Copilot/i });
    fireEvent.click(copilotBtn);

    // Verify the drawer is opened and visible
    expect(screen.getByRole('heading', { name: /Coaching Decision Copilot/i })).toBeInTheDocument();
  });

  it('toggles the APID Copilot drawer when Ctrl+K is pressed anywhere in the app', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ApidCopilotProvider>
            <AppLayout>
              <div>Dashboard Page Content</div>
            </AppLayout>
          </ApidCopilotProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Trigger Ctrl+K
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('heading', { name: /Coaching Decision Copilot/i })).toBeInTheDocument();

    // Press Escape to close
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: /Coaching Decision Copilot/i })).not.toBeInTheDocument();
  });
});
