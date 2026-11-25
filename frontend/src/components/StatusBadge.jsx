const STYLES = {
  scheduled: 'bg-blue-100 text-blue-800 ring-blue-600/20',
  retrying: 'bg-orange-100 text-orange-800 ring-orange-600/20',
  waiting: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
  active: 'bg-indigo-100 text-indigo-800 ring-indigo-600/20',
  completed: 'bg-green-100 text-green-800 ring-green-600/20',
  failed: 'bg-red-100 text-red-800 ring-red-600/20',
  cancelled: 'bg-gray-100 text-gray-700 ring-gray-500/20',
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STYLES[status] || STYLES.cancelled
      }`}
    >
      {status}
    </span>
  );
}
