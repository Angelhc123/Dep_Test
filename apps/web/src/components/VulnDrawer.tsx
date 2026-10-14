import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Vulnerability } from "@depscan/core";
import { api } from "../lib/api";
import { vulnUrl } from "../lib/format";
import { ErrorBox, SeverityBadge, Spinner } from "./ui";

const SOURCE_LABEL: Record<Vulnerability["severitySource"], string> = {
  nvd: "CVSS de NVD",
  "osv-cvss": "CVSS calculado desde el vector de OSV",
  "osv-label": "Etiqueta de la base de avisos (GHSA)",
  none: "Sin dato de severidad",
};

/** Panel lateral con el detalle completo de una vulnerabilidad (desde OSV, con caché en el servidor). */
export function VulnDrawer({ vuln, onClose }: { vuln: Vulnerability; onClose: () => void }) {
  const osvId = vuln.aliases.find((a) => !a.startsWith("CVE-")) ?? vuln.id;
  const detail = useQuery({ queryKey: ["vuln", osvId], queryFn: () => api.getVuln(osvId) });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Detalle de ${vuln.id}`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{vuln.id}</h2>
            <p className="mt-1 text-zinc-600 dark:text-zinc-300">{vuln.summary}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-2xl leading-none text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-zinc-500">Severidad</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={vuln.severity} score={vuln.cvss} />
            <span className="text-xs text-zinc-500">{SOURCE_LABEL[vuln.severitySource]}</span>
          </dd>
          {vuln.cvssVector && (
            <>
              <dt className="text-zinc-500">Vector</dt>
              <dd className="break-all font-mono text-xs">{vuln.cvssVector}</dd>
            </>
          )}
          <dt className="text-zinc-500">Alias</dt>
          <dd className="flex flex-wrap gap-2">
            {vuln.aliases.map((a) => (
              <a
                key={a}
                href={vulnUrl(a)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs underline"
              >
                {a}
              </a>
            ))}
          </dd>
          <dt className="text-zinc-500">Corregida en</dt>
          <dd>{vuln.fixedIn.length ? vuln.fixedIn.join(", ") : "Sin versión corregida publicada"}</dd>
          {vuln.published && (
            <>
              <dt className="text-zinc-500">Publicada</dt>
              <dd>{new Date(vuln.published).toLocaleDateString("es")}</dd>
            </>
          )}
        </dl>

        <h3 className="mb-2 mt-6 font-semibold">Descripción</h3>
        {detail.isPending && <Spinner label="Cargando detalle desde OSV…" />}
        {detail.error && <ErrorBox error={detail.error} />}
        {detail.data && (
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-950">
            {detail.data.details ?? vuln.details ?? "Sin descripción."}
          </pre>
        )}

        {vuln.references.length > 0 && (
          <>
            <h3 className="mb-2 mt-6 font-semibold">Referencias</h3>
            <ul className="space-y-1 text-sm">
              {vuln.references.map((r) => (
                <li key={r} className="truncate">
                  <a
                    href={r}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 underline dark:text-blue-400"
                  >
                    {r}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}
