import { useCallback, useEffect, useMemo, useState } from 'react';
import { cancelEmail, getHealth, listEmails } from '../services/api.js';
import ScheduleForm from '../components/ScheduleForm.jsx';
import JobTable from '../components/JobTable.jsx';
import JobDetails from '../components/JobDetails.jsx';
import Toasts from '../components/Toasts.jsx';
import HealthBadge from '../components/HealthBadge.jsx';

const FILTERS = ['all', 'scheduled', 'retrying', 'waiting', 'active', 'completed', 'failed', 'cancelled'];
const POLL_MS = 4000;

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [health, setHealth] = useState(null);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (type, message) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  const refresh = useCallback(async () => {
    try {
      const res = await listEmails();
      setJobs(res.data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh the table and health indicator.
  useEffect(() => {
    const tick = async () => {
      refresh();
      setHealth(await getHealth());
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const counts = useMemo(() => {
    const c = { all: jobs.length };
    jobs.forEach((j) => {
      c[j.status] = (c[j.status] || 0) + 1;
    });
    return c;
  }, [jobs]);

  const visible = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

  const handleScheduled = (job) => {
    notify('success', `Scheduled email to ${job.to}`);
    refresh();
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this scheduled email?')) return;
    try {
      await cancelEmail(id);
      notify('success', 'Email cancelled');
    } catch (err) {
      notify('error', err.message);
    }
    refresh();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Toasts toasts={toasts} onDismiss={dismiss} />

      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">ReachInbox Email Scheduler</h1>
          <p className="text-sm text-slate-500">BullMQ delayed jobs + Redis + Ethereal SMTP</p>
        </div>
        <HealthBadge health={health} />
      </header>

      {health && health.redis !== 'up' && health.status !== 'unreachable' && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Redis is down. Start it with <code>docker compose up -d</code>.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ScheduleForm onSuccess={handleScheduled} onError={(msg) => notify('error', msg)} />
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Scheduled emails</h2>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f} ({counts[f] || 0})
                </button>
              ))}
            </div>
          </div>

          {loadError && <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{loadError}</div>}

          <JobTable jobs={visible} loading={loading} onSelect={setSelectedId} onCancel={handleCancel} />
        </section>
      </div>

      {selectedId && <JobDetails id={selectedId} onClose={() => setSelectedId(null)} onCancel={handleCancel} />}
    </div>
  );
}
