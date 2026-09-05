export function Placeholder({
  phase,
  title,
  icon,
  description,
}: {
  phase: string;
  title: string;
  icon: string;
  description: string;
}) {
  return (
    <div className="text-center py-16 max-w-md mx-auto">
      <p className="text-4xl mb-3" aria-hidden>
        {icon}
      </p>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-500 mt-2 mb-4">{description}</p>
      <p className="text-xs text-slate-400">Coming in {phase} of the rollout plan.</p>
    </div>
  );
}
