import StatusBadge from './StatusBadge.jsx';
import { CANCELLABLE, formatDateTime } from '../utils/format.js';

export default function JobTable({ jobs, loading, onSelect, onCancel }) {
  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading...</div>;
  }
  if (jobs.length === 0) {
    return <div className="p-8 text-center text-sm text-slate-500">No emails here yet. Schedule one using the form.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Recipient</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Scheduled for</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Tries</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {jobs.map((job) => (
            <tr key={job.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3">{job.to}</td>
              <td className="max-w-[200px] truncate px-4 py-3" title={job.subject}>
                {job.subject}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(job.scheduledAt)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={job.status} />
              </td>
              <td className="px-4 py-3 text-slate-600">
                {job.attemptsMade}/{job.maxAttempts}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <button onClick={() => onSelect(job.id)} className="mr-3 text-indigo-600 hover:underline">
                  View
                </button>
                {CANCELLABLE.includes(job.status) && (
                  <button onClick={() => onCancel(job.id)} className="text-red-600 hover:underline">
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
