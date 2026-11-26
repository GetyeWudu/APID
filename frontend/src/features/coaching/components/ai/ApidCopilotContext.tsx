import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { coreConfigApi } from '../../../admin/config/api/coreConfigApi';
import { AskApidCopilotDrawer } from './AskApidCopilotDrawer';

interface ApidCopilotContextType {
  isOpen: boolean;
  openCopilot: (initialQuery?: string) => void;
  closeCopilot: () => void;
  toggleCopilot: () => void;
}

const ApidCopilotContext = createContext<ApidCopilotContextType | undefined>(undefined);

export const ApidCopilotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);
  const navigate = useNavigate();

  const activeConfigQuery = useQuery({
    queryKey: ['core', 'active-config'],
    queryFn: coreConfigApi.getActiveConfig,
    staleTime: 60_000,
  });
  const activeQuarterId = activeConfigQuery.data?.activeQuarter?.quarterId ?? 2;

  const openCopilot = useCallback((query?: string) => {
    if (query) {
      setInitialQuery(query);
    }
    setIsOpen(true);
  }, []);

  const closeCopilot = useCallback(() => {
    setIsOpen(false);
    setInitialQuery(undefined);
  }, []);

  const toggleCopilot = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Global Omnipresent Keyboard Shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        toggleCopilot();
      } else if (e.key === 'Escape' && isOpen) {
        closeCopilot();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggleCopilot, closeCopilot]);

  // Deep-linking navigation handlers for action cards
  const handleOpenDossier = useCallback(
    (assignmentId: number) => {
      closeCopilot();
      navigate(`/coaching/pms?tab=roster&assignmentId=${assignmentId}`);
    },
    [closeCopilot, navigate]
  );

  const handleFilterBranch = useCallback(
    (district: string, branch: string) => {
      closeCopilot();
      navigate(
        `/coaching/pms?tab=roster&district=${encodeURIComponent(district)}&branch=${encodeURIComponent(branch)}`
      );
    },
    [closeCopilot, navigate]
  );

  const handleFilterDistrict = useCallback(
    (district: string) => {
      closeCopilot();
      navigate(`/coaching/pms?tab=matrix&district=${encodeURIComponent(district)}`);
    },
    [closeCopilot, navigate]
  );

  const handleInspectSession = useCallback(
    (sessionId: number) => {
      closeCopilot();
      navigate(`/coaching?view=sessions&session=${sessionId}`);
    },
    [closeCopilot, navigate]
  );

  return (
    <ApidCopilotContext.Provider value={{ isOpen, openCopilot, closeCopilot, toggleCopilot }}>
      {children}
      <AskApidCopilotDrawer
        isOpen={isOpen}
        onClose={closeCopilot}
        quarterId={activeQuarterId}
        initialQuery={initialQuery}
        onOpenDossier={handleOpenDossier}
        onFilterBranch={handleFilterBranch}
        onFilterDistrict={handleFilterDistrict}
        onInspectSession={handleInspectSession}
      />
    </ApidCopilotContext.Provider>
  );
};

export const useApidCopilot = (): ApidCopilotContextType => {
  const context = useContext(ApidCopilotContext);
  if (!context) {
    throw new Error('useApidCopilot must be used within an ApidCopilotProvider');
  }
  return context;
};
