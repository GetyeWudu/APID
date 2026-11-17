import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { extractApiErrorMessage } from '../../../shared/api/apiClient';
import { useToast } from '../../../shared/components/ui';
import { mentoringPairingApi, type MentoringSession } from '../api/mentoringPairingApi';

export function MentoringSessionReport({
  session,
  isMentor,
}: {
  session: MentoringSession;
  isMentor: boolean;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [reportNote, setReportNote] = useState('');
  const [submittedReport, setSubmittedReport] = useState<string | null>(null);
  const scheduledEnd = new Date(session.scheduledEnd).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const refreshAtSessionEnd = () => {
      const remaining = scheduledEnd - Date.now();
      if (remaining <= 0) {
        setNow(Date.now());
        return;
      }
      timeout = setTimeout(refreshAtSessionEnd, Math.min(remaining, 2_147_483_647));
    };

    if (Number.isFinite(scheduledEnd)) refreshAtSessionEnd();
    return () => {
      if (timeout !== undefined) clearTimeout(timeout);
    };
  }, [scheduledEnd]);

  const reportMutation = useMutation({
    mutationFn: () =>
      mentoringPairingApi.submitSessionReport(session.relationshipId, session.id, reportNote.trim()),
    onSuccess: async (updatedSession) => {
      setSubmittedReport(updatedSession.notes ?? reportNote.trim());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'sessions', session.relationshipId] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'my-sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'pairing', 'detail', session.relationshipId] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-pairing-report', session.relationshipId] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-pairing-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['mentoring', 'hr-overview'] }),
      ]);
      setReportNote('');
      pushToast({
        title: 'Session report submitted',
        message: 'The session is now marked complete.',
        tone: 'ok',
      });
    },
    onError: (error: unknown) =>
      pushToast({
        title: 'Unable to submit session report',
        message: extractApiErrorMessage(error, 'Please try again.'),
        tone: 'err',
      }),
  });

  const submitReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (reportNote.trim()) reportMutation.mutate();
  };

  const visibleReport = submittedReport ?? session.notes;
  if (visibleReport?.trim()) {
    return (
      <section className="apid-card" aria-label="Session report">
        <h4 style={{ margin: 0 }}>Session report</h4>
        <p style={{ margin: '0.35rem 0 0', whiteSpace: 'pre-wrap' }}>{visibleReport}</p>
      </section>
    );
  }

  const reportIsDue =
    session.status === 'CONFIRMED' && Number.isFinite(scheduledEnd) && now >= scheduledEnd;
  if (!reportIsDue) return null;
  if (!isMentor) {
    return (
      <p className="boa-muted" role="status">
        The end-of-session report is waiting for the mentor.
      </p>
    );
  }

  return (
    <form className="apid-card boa-stack" onSubmit={submitReport}>
      <div>
        <h4 className="boa-card-title">Session report due</h4>
        <p className="boa-card-subtitle">Submit a brief report to mark this session complete.</p>
      </div>
      <label>
        Session report
        <textarea
          className="apid-input"
          rows={4}
          maxLength={4000}
          value={reportNote}
          onChange={(event) => setReportNote(event.target.value)}
          required
          disabled={reportMutation.isPending}
        />
      </label>
      <div>
        <button
          type="submit"
          className="apid-btn apid-btn-primary apid-btn-sm"
          disabled={!reportNote.trim() || reportMutation.isPending}
        >
          {reportMutation.isPending ? 'Submitting...' : 'Submit report and complete session'}
        </button>
      </div>
    </form>
  );
}
