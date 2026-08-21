export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  return (
    <div className="card overflow-hidden rounded-2xl">
      <div className="border-b border-[var(--line)] px-5 py-3">
        <div className="kicker">Master pipeline</div>
        <div className="serif text-xl">How far the list has gotten</div>
      </div>
      <ol className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.label} className="border-[var(--line)] px-4 py-4 md:border-r last:border-r-0">
            <div className="serif text-3xl">{s.value}</div>
            <div className="text-xs text-[var(--muted)]">
              {s.label.includes("LOI / price / structure") ? (
                <>
                  5.{" "}
                  <strong className="font-black tracking-[0.14em] text-[var(--ink)]">
                    LOI
                  </strong>{" "}
                  / price / structure
                </>
              ) : (
                s.label
              )}
            </div>
            {i < steps.length - 1 && <div className="mt-2 text-[10px] tracking-widest text-[var(--brass)]">↓ NEXT</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}
