import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw, BarChart2, FileSpreadsheet, Loader2 } from 'lucide-react';
import { pmsReportApi } from '../api/pmsReportApi';
import { CoachingSummaryCards } from './reports/CoachingSummaryCards';
import { TalentDossierDrawer } from './reports/TalentDossierDrawer';
import { DistrictComparativeMatrix } from './reports/DistrictComparativeMatrix';
import { CompetencyGapDiagnostic } from './reports/CompetencyGapDiagnostic';
import { AiExecutiveBriefingBanner } from './ai/AiExecutiveBriefingBanner';
import { AskApidCopilotDrawer } from './ai/AskApidCopilotDrawer';
import { useToast } from '../../../shared/components/ui';

interface PmsReportsTabProps {
  directorateCounts?: Array<{ directorate: string; mandatory: number; skillDev: number; overdue: number }>;
  assignments?: any[];
}

export const PmsReportsTab: React.FC<PmsReportsTabProps> = () => {
  const { pushToast } = useToast();

  const [selectedDirectorate, setSelectedDirectorate] = useState<string>('ALL');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);

  // 1. Fetch Executive Summary
  const summaryQuery = useQuery({
    queryKey: ['pms-coaching-report-summary'],
    queryFn: () => pmsReportApi.getSummary(),
    staleTime: 30_000,
  });

  // 2. Fetch Multi-Tier Hierarchical Analytics (District & Branch)
  const hierarchicalQuery = useQuery({
    queryKey: ['pms-hierarchical-analytics'],
    queryFn: () => pmsReportApi.getHierarchicalAnalytics(),
    staleTime: 30_000,
  });

  // 3. Fetch Dossier for Drawer (when talent selected from copilot)
  const dossierQuery = useQuery({
    queryKey: ['pms-talent-dossier', selectedAssignmentId],
    queryFn: () =>
      selectedAssignmentId ? pmsReportApi.getTalentDossier(selectedAssignmentId) : null,
    enabled: !!selectedAssignmentId,
  });

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      await pmsReportApi.downloadCsv({
        directorate: selectedDirectorate !== 'ALL' ? selectedDirectorate : undefined,
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

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await pmsReportApi.downloadDistrictExcel(
        2,
        selectedDirectorate !== 'ALL' ? selectedDirectorate : undefined
      );
      pushToast({
        title: 'Scorecard Exported',
        message: 'Bank of Abyssinia Multi-Tab Excel Scorecard exported successfully.',
        tone: 'ok',
      });
    } catch (err: any) {
      pushToast({
        title: 'Export Failed',
        message: err?.message || 'Could not export district Excel scorecard.',
        tone: 'err',
      });
    } finally {
      setIsExportingExcel(false);
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
          background: 'linear-gradient(135deg, rgba(202, 138, 4, 0.06) 0%, rgba(15, 23, 42, 0.02) 100%)',
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
              Enterprise Coaching Decision Support
            </span>
            <span className="boa-pill boa-pill-neutral" style={{ fontSize: '0.72rem' }}>
              {summaryQuery.data?.fiscalQuarterName || 'FY 2026/27 · Q2'}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)' }}>
            Coaching Diagnostic Reports &amp; Competency Benchmarks
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
            Regional performance comparison, skill deficiency clustering, and executive governance downloads.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              void summaryQuery.refetch();
              void hierarchicalQuery.refetch();
            }}
            disabled={summaryQuery.isFetching || hierarchicalQuery.isFetching}
            className="apid-btn apid-btn-outline apid-btn-sm"
            title="Refresh Report Data"
          >
            <RefreshCw
              size={13}
              className={summaryQuery.isFetching || hierarchicalQuery.isFetching ? 'animate-spin' : ''}
            />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="apid-btn apid-btn-outline apid-btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: '#ffffff',
              border: '1px solid #d1d5db',
              color: '#0f172a',
              fontWeight: 600,
            }}
            title="Export official multi-tab Bank of Abyssinia Excel Scorecard"
          >
            {isExportingExcel ? (
              <Loader2 size={13} className="animate-spin" style={{ color: '#16a34a' }} />
            ) : (
              <Download size={13} style={{ color: '#16a34a' }} />
            )}
            <span>{isExportingExcel ? 'Exporting...' : 'Export Excel'}</span>
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

      {/* 0.5. AI Executive Intelligence Briefing */}
      <AiExecutiveBriefingBanner
        quarterId={2}
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />

      {/* 1. Macro KPI Executive Summary */}
      <CoachingSummaryCards
        summary={summaryQuery.data || null}
        loading={summaryQuery.isLoading}
      />

      {/* 2. District & Regional Performance Comparison Matrix */}
      <DistrictComparativeMatrix
        analytics={hierarchicalQuery.data || null}
        loading={hierarchicalQuery.isLoading}
        selectedDistrict={selectedDirectorate}
        onSelectDistrict={(dist) => setSelectedDirectorate(dist)}
        onSelectBranch={(dist) => setSelectedDirectorate(dist)}
      />

      {/* 3. Competency & Skill Gap Diagnostic */}
      <CompetencyGapDiagnostic analytics={hierarchicalQuery.data || null} />

      {/* 4. Official Executive Governance Reports & Data Exports */}
      <div
        className="apid-card"
        style={{
          padding: '1.25rem 1.5rem',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ marginBottom: '1rem' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '0.95rem',
              fontWeight: 800,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <FileSpreadsheet size={16} style={{ color: '#ca8a04' }} />
            Official Governance Reports &amp; Data Exports
          </h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
            Export certified Bank of Abyssinia coaching reports, regional scorecards, and audit logs for executive review and compliance archiving.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Card 1: Multi-Tab District Excel Scorecard */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.35rem',
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                  Regional Excel Scorecard
                </span>
                <span className="boa-pill boa-pill-ok" style={{ fontSize: '0.68rem' }}>
                  XLSX (3 Sheets)
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>
                Multi-tab workbook containing District Rollups, Branch Matrix, and Full Staff Remediation Roster with executive color banding.
              </p>
            </div>
            <button
              type="button"
              disabled={isExportingExcel}
              onClick={handleExportExcel}
              className="apid-btn apid-btn-outline apid-btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                color: '#0f172a',
                cursor: isExportingExcel ? 'not-allowed' : 'pointer',
              }}
            >
              {isExportingExcel ? (
                <Loader2 size={13} className="animate-spin" style={{ color: '#16a34a' }} />
              ) : (
                <Download size={13} style={{ color: '#16a34a' }} />
              )}
              <span>{isExportingExcel ? 'Generating Scorecard...' : 'Export Excel Scorecard'}</span>
            </button>
          </div>

          {/* Card 2: Bank-Wide Tabular CSV Dump */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.35rem',
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                  Tabular Coaching Progress CSV
                </span>
                <span className="boa-pill boa-pill-info" style={{ fontSize: '0.68rem' }}>
                  CSV (Raw Data)
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>
                Complete raw dataset formatted for external BI tools (PowerBI, Tableau) and audit tracking across all bank directorates.
              </p>
            </div>
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportCsv}
              className="apid-btn apid-btn-outline apid-btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                color: '#0f172a',
                cursor: isExporting ? 'not-allowed' : 'pointer',
              }}
            >
              <Download size={13} style={{ color: '#ca8a04' }} />
              <span>{isExporting ? 'Exporting CSV...' : 'Export Raw CSV'}</span>
            </button>
          </div>

          {/* Card 3: Operational Dossier Guidance */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.35rem',
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                  Individual Dossiers &amp; Operations
                </span>
                <span className="boa-pill boa-pill-neutral" style={{ fontSize: '0.68rem' }}>
                  PDF on Overview
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>
                To view session evidence, reassign coaches, or export official 1-page PDF dossiers for individual coachees, navigate to <strong>Coaching Overview</strong>.
              </p>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', padding: '0.4rem 0' }}>
              Operational actions managed on Coaching Overview
            </div>
          </div>
        </div>
      </div>

      {/* 5. Talent Dossier Drawer */}
      <TalentDossierDrawer
        dossier={dossierQuery.data || null}
        isOpen={!!selectedAssignmentId}
        onClose={() => setSelectedAssignmentId(null)}
        loading={dossierQuery.isLoading}
      />

      {/* 6. Ask APID Decision Copilot Drawer */}
      <AskApidCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        quarterId={2}
        onOpenDossier={(assignmentId) => setSelectedAssignmentId(assignmentId)}
        onFilterDistrict={(dist) => setSelectedDirectorate(dist)}
        onFilterBranch={(dist) => setSelectedDirectorate(dist)}
      />
    </div>
  );
};

export default PmsReportsTab;
