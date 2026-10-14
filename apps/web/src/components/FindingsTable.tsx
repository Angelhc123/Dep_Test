import { useMemo, useState } from "react";
import type { Finding, Severity, Vulnerability } from "@depscan/core";
import { RISK_COLOR, SEVERITIES, SEVERITY_LABEL } from "../lib/format";
import { SeverityBadge } from "./ui";

interface Filters {
  text: string;
  severity: Severity | "all";
  kind: "all" | "direct" | "transitive";
  ecosystem: "all" | "npm" | "PyPI";
  hideDev: boolean;
}

const select =
  "rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function RecommendedCell({ finding: x }: { finding: Finding }) {
  const rec = x.remediation?.recommended ?? x.minSafeVersion;
  const breaking = x.remediation
    ? x.remediation.options.find((o) => o.version === rec)?.breaking
    : x.majorBump;
  if (!rec) {
    return (
      <span className="text-zinc-500">
        {x.remediation?.status === "no-fix" ? "sin versión segura" : "sin corrección"}
      </span>
    );
  }
  return (
    <>
      <code className="font-semibold">{rec}</code>
      {breaking && <div className="text-xs font-semibold text-amber-600">salto de versión mayor</div>}
      {x.remediation?.fixableByLockfileUpdate && (
        <div className="text-xs text-green-700 dark:text-green-400">basta con npm update</div>
      )}
      {x.remediation && x.remediation.totalSafeVersions > 1 && (
        <div className="text-xs text-zinc-500">{x.remediation.totalSafeVersions} versiones seguras</div>
      )}
    </>
  );
}

export function FindingsTable({
  findings,
  onSelect,
  onSolution,
}: {
  findings: Finding[];
  onSelect: (v: Vulnerability) => void;
  onSolution: (f: Finding) => void;
}) {
  const [f, setF] = useState<Filters>({
    text: "",
    severity: "all",
    kind: "all",
    ecosystem: "all",
    hideDev: false,
  });

  const rows = useMemo(() => {
    const q = f.text.trim().toLowerCase();
    return findings.filter((x) => {
      const d = x.dependency;
      if (f.severity !== "all" && x.maxSeverity !== f.severity) return false;
      if (f.kind === "direct" && !d.direct) return false;
      if (f.kind === "transitive" && d.direct) return false;
      if (f.ecosystem !== "all" && d.ecosystem !== f.ecosystem) return false;
      if (f.hideDev && d.dev) return false;
      if (
        q &&
        !d.name.toLowerCase().includes(q) &&
        !x.vulnerabilities.some((v) => v.aliases.some((a) => a.toLowerCase().includes(q)))
      ) {
        return false;
      }
      return true;
    });
  }, [findings, f]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Buscar paquete o CVE…"
          value={f.text}
          onChange={(e) => setF({ ...f, text: e.target.value })}
          className={`${select} min-w-0 flex-1 sm:max-w-xs`}
        />
        <select
          className={select}
          value={f.severity}
          onChange={(e) => setF({ ...f, severity: e.target.value as Filters["severity"] })}
        >
          <option value="all">Toda severidad</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className={select}
          value={f.kind}
          onChange={(e) => setF({ ...f, kind: e.target.value as Filters["kind"] })}
        >
          <option value="all">Directas y transitivas</option>
          <option value="direct">Solo directas</option>
          <option value="transitive">Solo transitivas</option>
        </select>
        <select
          className={select}
          value={f.ecosystem}
          onChange={(e) => setF({ ...f, ecosystem: e.target.value as Filters["ecosystem"] })}
        >
          <option value="all">npm y PyPI</option>
          <option value="npm">npm</option>
          <option value="PyPI">PyPI</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={f.hideDev}
            onChange={(e) => setF({ ...f, hideDev: e.target.checked })}
          />
          Ocultar dev
        </label>
        <span className="ml-auto text-sm text-zinc-500">
          {rows.length} de {findings.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="w-6 p-3" />
              <th className="p-3">Paquete</th>
              <th className="p-3">Versión</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Vulnerabilidades</th>
              <th className="p-3">Recomendada</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => {
              const d = x.dependency;
              return (
                <tr
                  key={`${d.ecosystem}:${d.name}@${d.resolved}:${d.sourceFile}`}
                  className="border-b border-zinc-100 align-top last:border-0 dark:border-zinc-800"
                >
                  <td className="p-3">
                    <span
                      className="mt-1 block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: RISK_COLOR[x.risk] }}
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-semibold">{d.name}</div>
                    <div className="text-xs text-zinc-500">
                      {d.ecosystem} · {d.sourceFile}
                    </div>
                  </td>
                  <td className="p-3">
                    <code>{d.resolved}</code>
                    {d.resolution === "registry-estimate" && (
                      <div className="text-xs font-semibold text-amber-600">estimada</div>
                    )}
                  </td>
                  <td className="p-3">
                    {d.direct ? "Directa" : "Transitiva"}
                    {d.dev && (
                      <span className="ml-1 rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">dev</span>
                    )}
                    {!d.direct && <div className="max-w-56 text-xs text-zinc-500">{d.path.join(" › ")}</div>}
                  </td>
                  <td className="p-3">
                    <ul className="space-y-1.5">
                      {x.vulnerabilities.map((v) => (
                        <li key={v.id} className="flex items-start gap-2">
                          <SeverityBadge severity={v.severity} score={v.cvss} />
                          <button onClick={() => onSelect(v)} className="text-left hover:underline">
                            <span className="font-mono text-xs">{v.id}</span>{" "}
                            <span className="text-zinc-600 dark:text-zinc-300">{v.summary}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="p-3">
                    <RecommendedCell finding={x} />
                    <button
                      onClick={() => onSolution(x)}
                      className="mt-1.5 rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      Ver solución
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-zinc-500">
                  Ningún hallazgo con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
