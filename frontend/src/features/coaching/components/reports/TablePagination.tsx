import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(validCurrentPage * pageSize, totalItems);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (validCurrentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (validCurrentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', validCurrentPage - 1, validCurrentPage, validCurrentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderTop: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        borderRadius: '0 0 12px 12px',
        fontSize: '0.82rem',
        color: '#475569',
      }}
      className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
    >
      {/* Left: Summary Count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>
          Showing <strong style={{ color: '#0f172a' }} className="dark:text-white">{startItem}</strong> to{' '}
          <strong style={{ color: '#0f172a' }} className="dark:text-white">{endItem}</strong> of{' '}
          <strong style={{ color: '#0f172a' }} className="dark:text-white">{totalItems.toLocaleString()}</strong> records
        </span>
      </div>

      {/* Middle & Right: Page Size & Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                fontSize: '0.78rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                cursor: 'pointer',
              }}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            >
              {pageSizeOptions.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={validCurrentPage <= 1}
            title="First Page"
            style={{
              padding: '0.3rem',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              backgroundColor: validCurrentPage <= 1 ? '#f1f5f9' : '#ffffff',
              color: validCurrentPage <= 1 ? '#94a3b8' : '#0f172a',
              cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          >
            <ChevronsLeft size={14} />
          </button>

          <button
            type="button"
            onClick={() => onPageChange(validCurrentPage - 1)}
            disabled={validCurrentPage <= 1}
            title="Previous Page"
            style={{
              padding: '0.3rem',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              backgroundColor: validCurrentPage <= 1 ? '#f1f5f9' : '#ffffff',
              color: validCurrentPage <= 1 ? '#94a3b8' : '#0f172a',
              cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Page Number Pills */}
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{ padding: '0 0.35rem', color: '#94a3b8', fontSize: '0.78rem' }}
                >
                  ...
                </span>
              );
            }
            const isCurrent = p === validCurrentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(p as number)}
                style={{
                  minWidth: '28px',
                  height: '28px',
                  padding: '0 0.4rem',
                  borderRadius: '6px',
                  border: isCurrent ? '1px solid #ca8a04' : '1px solid #e2e8f0',
                  backgroundColor: isCurrent ? '#fef08a' : '#ffffff',
                  color: isCurrent ? '#854d0e' : '#0f172a',
                  fontWeight: isCurrent ? 700 : 500,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                className={isCurrent ? 'dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-600' : 'dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}
              >
                {p}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onPageChange(validCurrentPage + 1)}
            disabled={validCurrentPage >= totalPages}
            title="Next Page"
            style={{
              padding: '0.3rem',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              backgroundColor: validCurrentPage >= totalPages ? '#f1f5f9' : '#ffffff',
              color: validCurrentPage >= totalPages ? '#94a3b8' : '#0f172a',
              cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          >
            <ChevronRight size={14} />
          </button>

          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={validCurrentPage >= totalPages}
            title="Last Page"
            style={{
              padding: '0.3rem',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              backgroundColor: validCurrentPage >= totalPages ? '#f1f5f9' : '#ffffff',
              color: validCurrentPage >= totalPages ? '#94a3b8' : '#0f172a',
              cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
