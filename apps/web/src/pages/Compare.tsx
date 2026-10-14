import { useQuery } from "@tanstack/react-query";
import type { Finding } from "@depscan/core";
import { Card, ErrorBox, RiskBadge, SeverityBadge, Spinner } from "../components/ui";
import { api, type SavedScan } from "../lib/api";
import { formatDate } from "../lib/format";

const key = (f: Finding, vulnId: string) => `${f.dependency.ecosystem}:${f.dependency.name}|${vulnId}`;

interface Row {
  pkg: string;
  version: string;
  vulnId: string;
  severity: Finding["maxSeverity"];
}

function index(scan: SavedScan): Map<string, Row> {
  const m = new Map<string, Row>();
  for (const f of scan.findings) {
    for (const v of f.vulnerabilities) {
      m.set(key(f, v.id), {
        pkg: f.dependency.name,
        version: f.dependency.resolved ?? "?",
        vulnId: v.id,
        severity: v.severity,
      });
    }
  }
  return m;
}

function RowList({ title, rows, tone }: { title: string; rows: Row[]; tone: string }) {
  return (
    <Card>
      <h2 className={`mb-3 font-semibold ${tone}`}>
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Ninguna.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <li key={`${r.pkg}|${r.vulnId}`} className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={r.severity} />
              <span className="font-medium">{r.pkg}</span>
              <code className="text-xs text-zinc-500">{r.version}</code>
              <span className="font-mono text-xs">{r.vulnId}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Compara dos escaneos: fallas nuevas, corregidas y persistentes (p. ej. antes/después de actualizar). */
export function Compare({ a, b }: { a: string; b: string }) {
  const qa = useQuery({ queryKey: ["scan", a], queryFn: () => api.getScan(a), enabled: Boolean(a) });
  const qb = useQuery({ queryKey: ["scan", b], queryFn: () => api.getScan(b), enabled: Boolean(b) });
  if (qa.error || qb.error) return <ErrorBox error={qa.error ?? qb.error} />;
  if (!qa.data || !qb.data) return <Spinner label="Cargando escaneos…" />;

  // El más antiguo es la base.
  const [older, newer] = qa.data.scannedAt <= qb.data.scannedAt ? [qa.data, qb.data] : [qb.data, qa.data];
  const io = index(older);
  const inw = index(newer);
  const added = [...inw].filter(([k]) => !io.has(k)).map(([, r]) => r);
  const fixed = [...io].filter(([k]) => !inw.has(k)).map(([, r]) => r);
  const kept = [...inw].filter(([k]) => io.has(k)).map(([, r]) => r);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Comparación de escaneos</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["Antes", older],
          ["Después", newer],
        ].map(([label, s]) => {
          const scan = s as SavedScan;
          return (
            <Card key={scan.id}>
              <div className="text-xs uppercase text-zinc-500">{label as string}</div>
              <a href={`#/scan/${scan.id}`} className="font-semibold hover:underline">
                {scan.target.name}
              </a>
              <div className="text-sm text-zinc-500">{formatDate(scan.scannedAt)}</div>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <RiskBadge risk={scan.summary.risk} />
                {scan.summary.vulnerableDependencies} dependencias vulnerables
              </div>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <RowList title="Nuevas" rows={added} tone="text-red-600" />
        <RowList title="Corregidas" rows={fixed} tone="text-green-600" />
        <RowList title="Persisten" rows={kept} tone="text-amber-600" />
      </div>
    </div>
  );
}
