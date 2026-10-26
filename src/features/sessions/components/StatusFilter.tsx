import { useId } from "react";
import {
  isKnownStatus,
  SESSION_STATUS_LABELS,
  SESSION_STATUSES,
  type StatusFilterValue,
} from "../types";

interface StatusFilterProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
  disabled: boolean;
}

export function StatusFilter({ value, onChange, disabled }: StatusFilterProps) {
  const selectId = useId();

  return (
    <div className="status-filter">
      <label htmlFor={selectId}>Status</label>
      <select
        id={selectId}
        name="status"
        className="select"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "all" || isKnownStatus(next)) {
            onChange(next);
          }
        }}
      >
        <option value="all">All</option>
        {SESSION_STATUSES.map((status) => (
          <option key={status} value={status}>
            {SESSION_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  );
}
