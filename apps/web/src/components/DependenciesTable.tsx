import { useMemo, useState } from "react";
import type { Dependency, Resolution } from "@depscan/core";

const RESOLUTION_LABEL: Record<Resolution, string> = {
  lockfile: "lockfile",
  "exact-pin": "versión fija",
  "registry-estimate": "estimada",
  unknown: "no determinable",
};

/** Todas las dependencias analizadas, para revisar qué versión se usó y por qué. */
export function DependenciesTable({ dependencies }: { dependencies: Dependency[] }) {
  const [text, setText] = useState("");
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);
  const rows = useMemo(() => {
    const q = text.trim().toLowerCase();
    return dependencies
      .filter((d) => (!onlyUnresolved || d.resolved === null) && (!q || d.name.toLowerCase().includes(q)))
      .slice(0, 500);
  }, [dependencies, text, onlyUnresolved]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar paquete…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm sm:max-w-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={onlyUnresolved}
            onChange={(e) => setOnlyUnresolved(e.target.checked)}
          />
          Solo sin versión
        </label>
        <span className="ml-auto text-sm text-zinc-500">
          {rows.length < dependencies.length ? `${rows.length} de ` : ""}
          {dependencies.length}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="p-3">Paquete</th>
              <th className="p-3">Declarada</th>
              <th className="p-3">Resuelta</th>
              <th className="p-3">Origen</th>
              <th className="p-3">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr
                key={`${d.name}@${d.resolved}:${d.sourceFile}:${i}`}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
              >
                <td className="p-3">
                  <span className="font-medium">{d.name}</span>{" "}
                  <span className="text-xs text-zinc-500">{d.ecosystem}</span>
                </td>
                <td className="p-3 font-mono text-xs">{d.declared || "—"}</td>
                <td className="p-3 font-mono text-xs">{d.resolved ?? "?"}</td>
                <td className="p-3">
                  <span className={d.resolved === null ? "text-amber-600" : ""}>
                    {RESOLUTION_LABEL[d.resolution]}
                  </span>
                  {d.note && <div className="text-xs text-zinc-500">{d.note}</div>}
                </td>
                <td className="p-3">
                  {d.direct ? "Directa" : "Transitiva"}
                  {d.dev ? " · dev" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
