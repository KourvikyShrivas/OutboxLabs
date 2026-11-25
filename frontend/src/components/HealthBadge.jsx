const Dot = ({ ok, label }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
    <span className={`h-2 w-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
    {label}
  </span>
);

export default function HealthBadge({ health }) {
  if (!health) return <span className="text-xs text-slate-400">checking...</span>;
  const apiUp = health.status !== 'unreachable';
  return (
    <div className="flex items-center gap-4">
      <Dot ok={apiUp} label="API" />
      <Dot ok={health.redis === 'up'} label="Redis" />
      <Dot ok={health.worker === 'running'} label="Worker" />
    </div>
  );
}
