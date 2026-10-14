import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Finding, Vulnerability } from "@depscan/core";
import { DependenciesTable } from "../components/DependenciesTable";
import { FindingsTable } from "../components/FindingsTable";
import { RemediationDrawer } from "../components/RemediationDrawer";
import { SeverityChart } from "../components/SeverityChart";
import { Card, ErrorBox, RiskBadge, Spinner, Stat } from "../components/ui";
import { VulnDrawer } from "../components/VulnDrawer";
import { api } from "../lib/api";
import { formatDate, SEVERITY_COLOR } from "../lib/format";

export function ScanResult({ id }: { id: string }) {
  const scan = useQuery({ queryKey: ["scan", id], queryFn: () => api.getScan(id) });
  const [tab, setTab] = useState<"findings" | "deps">("findings");
  const [selected, setSelected] = useState<Vulnerability | null>(null);
  const [solution, setSolution] = useState<Finding | null>(null);

  if (scan.isPending) return <Spinner label="Cargando escaneo…" />;
  if (scan.error) return <ErrorBox error={scan.error} />;
  const r = scan.data;
  const s = r.summary;
  const t = r.target;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{t.name}</h1>
          <p className="text-sm text-zinc-500">
            {formatDate(r.scannedAt)}
            {t.source === "github" && t.commit && (
              <>
                {" · "}
                <a
                  className="font-mono underline"
                  href={`https://github.com/${t.name}/tree/${t.commit}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.ref ? `${t.ref}@` : ""}
                  {t.commit.slice(0, 10)}
                </a>
              </>
            )}
            {" · "}depscan {r.scannerVersion} · {(r.durationMs / 1000).toFixed(1)} s
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RiskBadge risk={s.risk} large />
          {r.private && (
            <span className="rounded-full border border-amber-300 px-2.5 py-1 text-xs text-amber-700 dark:border-amber-800 dark:text-amber-300">
              Repo privado: solo tú lo ves
            </span>
          )}
          <div className="flex overflow-hidden rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
            <a
              href={api.reportHtmlUrl(id)}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Ver reporte
            </a>
            <a
              href={api.reportHtmlUrl(id, true)}
              className="border-l border-zinc-300 px-3 py-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Descargar HTML
            </a>
            <a
              href={api.reportPdfUrl(id)}
              className="border-l border-zinc-300 px-3 py-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Descargar PDF
            </a>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat value={`${s.vulnerableDependencies} / ${s.dependencies}`} label="Dependencias vulnerables" />
        <Stat
          value={s.bySeverity.critical}
          label="Fallas críticas"
          color={s.bySeverity.critical ? SEVERITY_COLOR.critical : undefined}
        />
        <Stat
          value={s.bySeverity.high}
          label="Fallas altas"
          color={s.bySeverity.high ? SEVERITY_COLOR.high : undefined}
        />
        <Stat value={`${s.direct} / ${s.transitive}`} label="Directas / transitivas" />
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
        <Card>
          <h2 className="mb-2 font-semibold">Fallas únicas por severidad</h2>
          <SeverityChart summary={s} />
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Manifiestos y advertencias</h2>
          <ul className="mb-3 flex flex-wrap gap-2">
            {r.manifests.map((m) => (
              <li key={m} className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs dark:bg-zinc-800">
                {m}
              </li>
            ))}
          </ul>
          {r.warnings.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-300">
              {r.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Sin advertencias.</p>
          )}
          {s.unresolved > 0 && (
            <p className="mt-2 text-sm text-zinc-500">
              {s.unresolved} dependencia(s) sin versión determinable no se verificaron.
            </p>
          )}
        </Card>
      </div>

      <div>
        <div className="mb-3 flex gap-4 border-b border-zinc-200 dark:border-zinc-800" role="tablist">
          {(
            [
              ["findings", `Hallazgos (${r.findings.length})`],
              ["deps", `Todas las dependencias (${r.dependencies.length})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
                tab === k ? "border-zinc-900 dark:border-zinc-100" : "border-transparent text-zinc-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "findings" ? (
          r.findings.length ? (
            <FindingsTable findings={r.findings} onSelect={setSelected} onSolution={setSolution} />
          ) : (
            <Card>
              <p className="text-center text-zinc-600 dark:text-zinc-300">
                No se encontraron vulnerabilidades conocidas en las versiones analizadas.
              </p>
            </Card>
          )
        ) : (
          <DependenciesTable dependencies={r.dependencies} />
        )}
      </div>

      <p className="text-xs text-zinc-500">
        Limitaciones: se reportan versiones con fallas conocidas, no si el código usa la función afectada;
        solo se detecta lo publicado a la fecha del escaneo; sin lockfile la precisión baja.
      </p>

      {selected && <VulnDrawer vuln={selected} onClose={() => setSelected(null)} />}
      {solution && <RemediationDrawer finding={solution} onClose={() => setSolution(null)} />}
    </div>
  );
}
