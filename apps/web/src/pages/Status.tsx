import { useQuery } from "@tanstack/react-query";
import { Card, ErrorBox, Spinner, Stat } from "../components/ui";
import { api, type Metrics } from "../lib/api";
import { RISK_COLOR, RISK_LABEL } from "../lib/format";

/** Página "Estado": telemetría del servidor en vivo (se refresca cada 5 s). */
export function Status() {
  const q = useQuery({ queryKey: ["metrics"], queryFn: api.metrics, refetchInterval: 5000 });

  if (q.isPending) return <Spinner label="Cargando telemetría…" />;
  if (q.error) return <ErrorBox error={q.error} />;
  const m = q.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Estado del sistema</h1>
        <p className="text-sm text-zinc-500">
          Telemetría en vivo · depscan {m.version} · activo hace {uptime(m.uptimeSeconds)} · {m.memoryMb} MB
          de memoria · se actualiza cada 5 s ·{" "}
          <a className="underline" href="/metrics" target="_blank" rel="noreferrer">
            formato Prometheus
          </a>
        </p>
      </header>

      <section aria-label="Resumen">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat value={m.http.requests} label="Peticiones atendidas" />
          <Stat value={`${m.http.latencyMs.p95} ms`} label="Latencia p95" />
          <Stat
            value={`${m.http.errorRate} %`}
            label="Errores del servidor (5xx)"
            color={m.http.errorRate > 1 ? RISK_COLOR.red : RISK_COLOR.green}
          />
          <Stat value={m.scans.total} label="Escaneos desde el arranque" />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="mb-3 font-semibold">Sesiones</h2>
          <Rows
            rows={[
              ["Sesiones vigentes", m.sessions.active],
              ["Con cuenta iniciada", m.sessions.loggedIn],
              ["Usuarios registrados", m.sessions.users],
            ]}
          />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Historial</h2>
          <Rows
            rows={[
              ["Escaneos guardados", m.history.scansStored],
              ["Dependencias analizadas*", m.scans.dependencies],
              ["Dependencias vulnerables*", m.scans.vulnerableDependencies],
              ["Escaneos fallidos*", m.scans.failed],
            ]}
          />
          <p className="mt-2 text-xs text-zinc-500">* desde el último arranque</p>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Caché (OSV, NVD, registros)</h2>
          <Rows
            rows={[
              ["Tasa de aciertos", `${m.cache.hitRate} %`],
              ["Aciertos / fallos", `${m.cache.hits} / ${m.cache.misses}`],
              ["Entradas vigentes", m.cache.entries],
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <Card>
          <h2 className="mb-3 font-semibold">Escaneos por semáforo</h2>
          <RiskBars byRisk={m.scans.byRisk} total={m.scans.total} />
          <p className="mt-3 text-sm text-zinc-500">
            Duración: p50 {(m.scans.durationMs.p50 / 1000).toFixed(1)} s · p95{" "}
            {(m.scans.durationMs.p95 / 1000).toFixed(1)} s
          </p>
        </Card>
        <Card className="overflow-x-auto">
          <h2 className="mb-3 font-semibold">Rutas más usadas</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="py-1 pr-3">Ruta</th>
                <th className="py-1 pr-3 text-right">Peticiones</th>
                <th className="py-1 pr-3 text-right">Errores 5xx</th>
                <th className="py-1 text-right">p95</th>
              </tr>
            </thead>
            <tbody>
              {m.http.routes.slice(0, 10).map((r) => (
                <tr key={r.route} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5 pr-3 font-mono text-xs">{r.route}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{r.count}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{r.errors}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.p95Ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function Rows({ rows }: { rows: [string, string | number][] }) {
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt className="text-zinc-500">{k}</dt>
          <dd className="font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function RiskBars({ byRisk, total }: { byRisk: Metrics["scans"]["byRisk"]; total: number }) {
  if (!total) return <p className="text-sm text-zinc-500">Aún no hay escaneos desde el arranque.</p>;
  return (
    <ul className="space-y-2">
      {(["red", "yellow", "green"] as const).map((risk) => {
        const n = byRisk[risk] ?? 0;
        return (
          <li key={risk} className="text-sm">
            <div className="flex justify-between">
              <span>{RISK_LABEL[risk]}</span>
              <span className="tabular-nums">{n}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-2 rounded-full"
                style={{ width: `${(100 * n) / total}%`, backgroundColor: RISK_COLOR[risk] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function uptime(s: number): string {
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  return `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h`;
}
