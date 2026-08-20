import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const store = await readStore();
  return (
    <div className="space-y-6">
      <div>
        <div className="kicker">Team delegation</div>
        <h1 className="serif text-4xl">Who owns which questions</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Each deal can have its own acquisition team. When a diligence question appears, it is assigned
          automatically: revenue to the CPA, contracts to the attorney, loan math to the financial planner.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {store.teams.map((t) => (
          <section key={t.id} className="card rounded-2xl p-6">
            <h2 className="serif text-2xl">{t.name}</h2>
            <ul className="mt-4 space-y-3">
              {t.members.map((m) => (
                <li key={m.id} className="border-b border-[var(--line)] pb-3 last:border-0">
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-sm text-[var(--muted)]">
                    {m.role} · {m.specialty}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
