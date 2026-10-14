import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, ErrorBox, RiskBadge, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { useMe } from "../lib/auth";
import { navigate } from "../lib/router";

export function History() {
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => api.listScans(100) });
  const me = useMe();
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: api.deleteScan,
    onSuccess: () => {
      setConfirmDelete(null);
      void qc.invalidateQueries({ queryKey: ["scans"] });
    },
  });

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));

  if (scans.isPending) return <Spinner label="Cargando historial…" />;
  if (scans.error) return <ErrorBox error={scans.error} />;
  const items = scans.data.items;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Historial</h1>
          <p className="text-sm text-zinc-500">
            Las bases cambian a diario: cada escaneo guarda su fecha. Marca dos para compararlos.
          </p>
          {me.data && !me.data.user && (me.data.providers.google || me.data.providers.github) && (
            <p className="text-xs text-zinc-500">
              Sin cuenta, el historial queda asociado a este navegador.{" "}
              <a href="#/login" className="underline">
                Inicia sesión
              </a>{" "}
              para conservarlo en cualquier dispositivo.
            </p>
          )}
        </div>
        <Button
          disabled={picked.length !== 2}
          onClick={() => navigate(`/compare?a=${picked[0]}&b=${picked[1]}`)}
        >
          Comparar ({picked.length}/2)
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <p className="text-center text-zinc-500">
            Aún no hay escaneos.{" "}
            <a href="#/" className="underline">
              Crea el primero
            </a>
            .
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="w-8 p-3" />
                <th className="p-3">Proyecto</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Semáforo</th>
                <th className="p-3 text-right">Vulnerables</th>
                <th className="p-3 text-right">Crít. / Altas</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${s.targetName}`}
                      checked={picked.includes(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                  </td>
                  <td className="p-3">
                    <a href={`#/scan/${s.id}`} className="font-medium hover:underline">
                      {s.targetName}
                    </a>
                    <div className="text-xs text-zinc-500">
                      {s.source === "github"
                        ? "GitHub"
                        : s.source === "upload"
                          ? "Archivos subidos"
                          : "Carpeta"}
                      {s.commit && <span className="font-mono"> · {s.commit.slice(0, 8)}</span>}
                      {s.private && (
                        <span className="ml-1 rounded-full border border-amber-300 px-1.5 text-amber-700 dark:border-amber-800 dark:text-amber-300">
                          privado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-zinc-600 dark:text-zinc-300">{formatDate(s.createdAt)}</td>
                  <td className="p-3">
                    <RiskBadge risk={s.risk} />
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {s.summary.vulnerableDependencies} / {s.summary.dependencies}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {s.summary.bySeverity.critical} / {s.summary.bySeverity.high}
                  </td>
                  <td className="p-3 text-right">
                    {confirmDelete === s.id ? (
                      <span className="inline-flex gap-2">
                        <Button
                          variant="danger"
                          className="px-2 py-1"
                          onClick={() => del.mutate(s.id)}
                          disabled={del.isPending}
                        >
                          Eliminar
                        </Button>
                        <Button
                          variant="secondary"
                          className="px-2 py-1"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancelar
                        </Button>
                      </span>
                    ) : (
                      <button
                        className="text-zinc-400 hover:text-red-600"
                        onClick={() => setConfirmDelete(s.id)}
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {del.error && <ErrorBox error={del.error} />}
    </div>
  );
}
