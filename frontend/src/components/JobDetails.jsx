import { useCallback, useEffect, useState } from 'react';
import { getEmail } from '../services/api.js';
import StatusBadge from './StatusBadge.jsx';
import { CANCELLABLE, formatDateTime } from '../utils/format.js';

const Row = ({ label, children }) => (
  <div className="grid grid-cols-3 gap-2 py-2 text-sm">
    <dt className="font-medium text-slate-500">{label}</dt>
    <dd className="col-span-2 break-words text-slate-900">{children}</dd>
  </div>
);

export default function JobDetails({ id, onClose, onCancel }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getEmail(id);
      setJob(res.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    setJob(null);
    load();
  }, [load]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Email details</h3>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-700" aria-label="Close">
            ×
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!job && !error && <p className="text-sm text-slate-500">Loading...</p>}

        {job && (
          <>
            <dl className="divide-y divide-slate-100">
              <Row label="Status">
                <StatusBadge status={job.status} />
              </Row>
              <Row label="Recipient">{job.to}</Row>
              <Row label="Subject">{job.subject}</Row>
              <Row label="Message">
                <span className="whitespace-pre-wrap">{job.body}</span>
              </Row>
              <Row label="Scheduled for">{formatDateTime(job.scheduledAt)}</Row>
              <Row label="Created">{formatDateTime(job.createdAt)}</Row>
              <Row label="Finished">{formatDateTime(job.finishedAt)}</Row>
              <Row label="Attempts">
                {job.attemptsMade} of {job.maxAttempts}
              </Row>
              {job.failedReason && <Row label="Last error"><span className="text-red-700">{job.failedReason}</span></Row>}
              {job.previewUrl && (
                <Row label="Ethereal preview">
                  <a href={job.previewUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                    Open the sent email
                  </a>
                </Row>
              )}
              <Row label="Job ID">
                <code className="text-xs">{job.id}</code>
              </Row>
            </dl>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={load} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
                Refresh
              </button>
              {CANCELLABLE.includes(job.status) && (
                <button
                  onClick={async () => {
                    await onCancel(job.id);
                    load();
                  }}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Cancel email
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
