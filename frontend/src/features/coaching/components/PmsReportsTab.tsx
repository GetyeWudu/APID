import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw, BarChart2 } from 'lucide-react';
import { pmsReportApi } from '../api/pmsReportApi';
import { CoachingSummaryCards } from './reports/CoachingSummaryCards';
import { TalentProgressTable } from './reports/TalentProgressTable';
import { TalentDossierDrawer } from './reports/TalentDossierDrawer';
import { useToast } from '../../../shared/components/ui';

interface PmsReportsTabProps {
  directorateCounts?: Array<{ directorate: string; mandatory: number; skillDev: number; overdue: number }>;
  assignments?: any[];
}

export const PmsReportsTab: React.FC<PmsReportsTabProps> = () => {
  const { pushToast } = useToast();

  const [activeStatusTab, setActiveStatusTab] = useState<string>('ALL');
  const [selectedDirectorate, setSelectedDirectorate] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // 1. Fetch Executive Summary (The 4 big numbers & breakdown)
  const summaryQuery = useQuery({
    queryKey: ['pms-coaching-report-summary'],
    queryFn: () => pmsReportApi.getSummary(),
    staleTime: 30_000,
  });

  // 2. Fetch Filtered Talents Progress Table
  const talentsQuery = useQuery({
    queryKey: [
      'pms-coaching-report-talents',
      selectedDirectorate,
      activeStatusTab,
      searchQuery,
    ],
    queryFn: () =>
      pmsReportApi.getTalents({
        directorate: selectedDirectorate !== 'ALL' ? selectedDirectorate : undefined,
        status: activeStatusTab !== 'ALL' && activeStatusTab !== 'ATTENTION' ? activeStatusTab : undefined,
        attentionOnly: activeStatusTab === 'ATTENTION' ? true : undefined,
        search: searchQuery.trim() || undefined,
      }),
    staleTime: 15_000,
  });

  // 3. Fetch Dossier for Drawer (when talent selected)
  const dossierQuery = useQuery({
    queryKey: ['pms-talent-dossier', selectedAssignmentId],
    queryFn: () =>
      selectedAssignmentId ? pmsReportApi.getTalentDossier(selectedAssignmentId) : null,
    enabled: !!selectedAssignmentId,
  });

  // Extract unique directorates for dropdown
  const directorateOptions = summaryQuery.data?.directorateBreakdown.map((d) => d.directorate) || [];

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      await pmsReportApi.downloadCsv({
        directorate: selectedDirectorate !== 'ALL' ? selectedDirectorate : undefined,
        status: activeStatusTab !== 'ALL' && activeStatusTab !== 'ATTENTION' ? activeStatusTab : undefined,
        attentionOnly: activeStatusTab === 'ATTENTION' ? true : undefined,
      });
      pushToast({
        title: 'Report Downloaded',
        message: 'Bank of Abyssinia Coaching Performance Report exported successfully.',
        tone: 'ok',
      });
    } catch (err: any) {
      pushToast({
        title: 'Export Failed',
        message: err?.message || 'Could not export report data.',
        tone: 'err',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="boa-stack" style={{ gap: '1.25rem' }}>
      {/* Tab Header Banner */}
      <div
        className="apid-card"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'linear-gradient(135deg, rgba(202, 138, 4, 0.05) 0%, rgba(15, 23, 42, 0.02) 100%)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
                background: 'rgba(202, 138, 4, 0.15)',
                color: '#b45309',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <BarChart2 size={12} />
              Enterprise PMS Performance Governance
            </span>
            <span className="boa-pill boa-pill-neutral" style={{ fontSize: '0.72rem' }}>
              {summaryQuery.data?.fiscalQuarterName || 'Active Quarter'}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)' }}>
            Coaching Performance &amp; Competency Turnaround
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
            Real-time audit of low-performing employees (&lt; 3.0), verified competency gap closure, and session delivery pacing.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              summaryQuery.refetch();
              talentsQuery.refetch();
            }}
            disabled={summaryQuery.isFetching || talentsQuery.isFetching}
            className="apid-btn apid-btn-outline apid-btn-sm"
            title="Refresh Report Data"
          >
            <RefreshCw
              size={13}
              className={summaryQuery.isFetching || talentsQuery.isFetching ? 'animate-spin' : ''}
            />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="apid-btn apid-btn-primary apid-btn-sm"
            style={{
              background: 'linear-gradient(135deg, #f5b700 0%, #ca8a04 100%)',
              color: '#0f172a',
              fontWeight: 700,
            }}
          >
            <Download size={13} />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Part 1: The 4 Big Numbers (Executive Health Check) */}
      <CoachingSummaryCards
        summary={summaryQuery.data || null}
        loading={summaryQuery.isLoading}
        onFilterAll={() => setActiveStatusTab('ALL')}
        onFilterImproving={() => setActiveStatusTab('IMPROVING')}
        onFilterAtRisk={() => setActiveStatusTab('ATTENTION')}
      />

      {/* Part 2: Actionable Employee Progress Table */}
      <TalentProgressTable
        talents={talentsQuery.data || []}
        loading={talentsQuery.isLoading}
        activeStatusTab={activeStatusTab}
        onStatusTabChange={setActiveStatusTab}
        selectedDirectorate={selectedDirectorate}
        onDirectorateChange={setSelectedDirectorate}
        directorateOptions={directorateOptions}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectTalent={(assignmentId) => setSelectedAssignmentId(assignmentId)}
      />

      {/* Part 3: Individual Remediation Journey & Two-Way Session Log Drawer */}
      <TalentDossierDrawer
        dossier={dossierQuery.data || null}
        isOpen={!!selectedAssignmentId}
        onClose={() => setSelectedAssignmentId(null)}
        loading={dossierQuery.isLoading}
      />
    </div>
  );
};
export default PmsReportsTab;
