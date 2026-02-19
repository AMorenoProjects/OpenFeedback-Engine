const statusStyles: Record<string, string> = {
  open: "bg-of-primary-100 text-of-primary-700",
  planned: "bg-purple-100 text-purple-700",
  in_progress: "bg-amber-100 text-amber-700",
  shipped: "bg-green-100 text-green-700",
  closed: "bg-of-neutral-200 text-of-neutral-600",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In Progress",
  shipped: "Shipped",
  closed: "Closed",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        statusStyles[status] ?? statusStyles.open
      }`}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}
