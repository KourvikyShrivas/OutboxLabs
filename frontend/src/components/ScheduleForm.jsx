import { useState } from 'react';
import { scheduleEmail } from '../services/api.js';
import { toLocalInputValue } from '../utils/format.js';

const initialForm = () => ({
  to: '',
  subject: '',
  body: '',
  scheduledAt: toLocalInputValue(new Date(Date.now() + 2 * 60 * 1000)),
  attempts: '',
  backoffDelayMs: '',
});

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export default function ScheduleForm({ onSuccess, onError }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const setInMinutes = (m) => setForm((f) => ({ ...f, scheduledAt: toLocalInputValue(new Date(Date.now() + m * 60 * 1000)) }));

  const submit = async (e) => {
    e.preventDefault();
    const when = new Date(form.scheduledAt);
    if (Number.isNaN(when.getTime())) {
      onError('Please pick a valid date and time.');
      return;
    }

    const payload = {
      to: form.to.trim(),
      subject: form.subject.trim(),
      body: form.body.trim(),
      scheduledAt: when.toISOString(),
    };
    if (form.attempts) payload.attempts = Number(form.attempts);
    if (form.backoffDelayMs) payload.backoffDelayMs = Number(form.backoffDelayMs);

    setSubmitting(true);
    try {
      const res = await scheduleEmail(payload);
      onSuccess(res.data);
      setForm(initialForm());
    } catch (err) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Schedule a new email</h2>

      <label className="block text-sm font-medium text-slate-700">
        Recipient
        <input type="email" name="to" value={form.to} onChange={update} required placeholder="someone@example.com" className={inputClass} />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Subject
        <input type="text" name="subject" value={form.subject} onChange={update} required maxLength={200} className={inputClass} />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Message
        <textarea name="body" value={form.body} onChange={update} required rows={4} maxLength={10000} className={inputClass} />
      </label>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Send at
          <input type="datetime-local" step="1" name="scheduledAt" value={form.scheduledAt} onChange={update} required className={inputClass} />
        </label>
        <div className="mt-2 flex gap-2">
          {[1, 5, 60].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setInMinutes(m)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              {m === 60 ? 'In 1 hour' : `In ${m} min`}
            </button>
          ))}
        </div>
      </div>

      <details className="text-sm text-slate-600">
        <summary className="cursor-pointer select-none">Retry options (optional)</summary>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-700">
            Max attempts (1-10)
            <input type="number" min="1" max="10" name="attempts" value={form.attempts} onChange={update} placeholder="default" className={inputClass} />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Backoff (ms)
            <input type="number" min="100" step="100" name="backoffDelayMs" value={form.backoffDelayMs} onChange={update} placeholder="default" className={inputClass} />
          </label>
        </div>
      </details>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Scheduling...' : 'Schedule email'}
      </button>
    </form>
  );
}
