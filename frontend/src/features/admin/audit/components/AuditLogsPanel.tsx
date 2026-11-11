import { useCallback, useEffect, useState } from 'react';
import type { AxiosError } from 'axios';
import type { ApiErrorPayload } from '../../../../shared/api/apiClient';
import type { PageResponse } from '../../users/types/users.types';
import { auditApi } from '../api/auditApi';
import type { AuditEvent } from '../types/audit.types';

export function AuditLogsPanel() {
  const [data, setData] = useState<PageResponse<AuditEvent> | null>(null);
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditApi.search({
        module: moduleFilter,
        action: actionFilter,
        actorUsername: actorFilter,
        page,
        size: 15,
      });
      setData(res);
    } catch (err) {
      const ax = err as AxiosError<ApiErrorPayload>;
      setError(ax.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, actionFilter, actorFilter, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="apid-card">
      <div className="apid-toolbar">
        <div className="apid-toolbar-left">
          <select
            className="apid-input"
            value={moduleFilter}
            onChange={(e) => {
              setPage(0);
              setModuleFilter(e.target.value);
            }}
          >
            <option value="">All Modules</option>
            <option value="AUTH">AUTH</option>
            <option value="IAM">IAM</option>
          </select>
          <input
            type="text"
            className="apid-input"
            placeholder="Action (e.g. USER_CREATED)"
            value={actionFilter}
            onChange={(e) => {
              setPage(0);
              setActionFilter(e.target.value);
            }}
          />
          <input
            type="text"
            className="apid-input"
            placeholder="Actor username..."
            value={actorFilter}
            onChange={(e) => {
              setPage(0);
              setActorFilter(e.target.value);
            }}
          />
        </div>
        <button type="button" className="apid-btn apid-btn-outline" onClick={loadLogs}>
          Refresh
        </button>
      </div>

      {error && <div className="apid-alert apid-alert-err">{error}</div>}

      {loading ? (
        <p>Loading audit trail...</p>
      ) : (
        <div className="apid-table-wrap">
          <table className="apid-table">
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Module</th>
                <th>Action</th>
                <th>Result</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data?.content.map((ev) => (
                <>
                  <tr key={ev.id}>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(ev.createdAt).toLocaleString()}
                    </td>
                    <td><code>{ev.module}</code></td>
                    <td><strong>{ev.action}</strong></td>
                    <td>
                      <span
                        className={`apid-status ${
                          ev.result === 'SUCCESS' ? 'apid-status-active' : 'apid-status-disabled'
                        }`}
                      >
                        {ev.result}
                      </span>
                    </td>
                    <td>{ev.actorUsername || '—'}</td>
                    <td>{ev.entityType ? `${ev.entityType}#${ev.entityId ?? '?'}` : '—'}</td>
                    <td>
                      {ev.detailsJson || ev.reasonCode ? (
                        <button
                          type="button"
                          className="apid-btn apid-btn-sm"
                          onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                        >
                          {expandedId === ev.id ? 'Hide' : 'Inspect'}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                  {expandedId === ev.id && (
                    <tr key={`${ev.id}-details`}>
                      <td colSpan={7} style={{ background: 'var(--bg)' }}>
                        <pre style={{ margin: 0, fontSize: '0.78rem', overflowX: 'auto' }}>
                          {JSON.stringify(
                            {
                              requestId: ev.requestId,
                              reasonCode: ev.reasonCode,
                              ipAddress: ev.ipAddress,
                              details: ev.detailsJson,
                            },
                            null,
                            2
                          )}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="apid-pagination">
          <button
            type="button"
            className="apid-btn apid-btn-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <span>
            Page {data.number + 1} of {data.totalPages} ({data.totalElements} events)
          </span>
          <button
            type="button"
            className="apid-btn apid-btn-sm"
            disabled={page + 1 >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

