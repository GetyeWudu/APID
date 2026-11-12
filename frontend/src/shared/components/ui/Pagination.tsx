export function Pagination({
  page,
  totalPages,
  totalElements,
  itemLabel = 'items',
  disabled = false,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalElements?: number;
  itemLabel?: string;
  disabled?: boolean;
  onPageChange: (nextPage: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="apid-pagination">
      <button
        type="button"
        className="apid-btn apid-btn-outline apid-btn-sm"
        disabled={disabled || page <= 0}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span className="tabular-nums">
        Page {page + 1} of {totalPages}
        {typeof totalElements === 'number' ? ` (${totalElements} ${itemLabel})` : ''}
      </span>
      <button
        type="button"
        className="apid-btn apid-btn-outline apid-btn-sm"
        disabled={disabled || page + 1 >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

