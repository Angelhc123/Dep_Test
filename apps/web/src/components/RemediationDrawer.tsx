import { useEffect, useState } from "react";
import type { Finding, Remediation } from "@depscan/core";
import { vulnUrl } from "../lib/format";
import { SeverityBadge } from "./ui";

const OPTION_LABEL: Record<Remediation["options"][number]["kind"], string> = {
  minimal: "Mínima segura",
  "same-major": "Más nueva sin cambio mayor",
  latest: "Más nueva segura",
};

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-zinc-100 p-3 pr-16 font-mono text-xs dark:bg-zinc-950">
        {text}
      </pre>
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="absolute right-2 top-2 rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** Panel lateral con todo lo necesario para resolver (o mitigar) un hallazgo. */
export function RemediationDrawer({ finding, onClose }: { finding: Finding; onClose: () => void }) {
  const d = finding.dependency;
  const r = finding.remediation;
  const [showAll, setShowAll] = useState(false);

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
        aria-label={`Solución para ${d.name}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Cómo resolverlo</p>
            <h2 className="text-xl font-bold">
              {d.name} <code className="text-base font-normal">{d.resolved}</code>
            </h2>
            <p className="text-sm text-zinc-500">
              {d.ecosystem} · {d.direct ? "dependencia directa" : `transitiva: ${d.path.join(" › ")}`}
              {d.requiredBy && ` (${d.requiredBy.name} pide "${d.requiredBy.range}")`}
              {d.dev && " · solo desarrollo"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-2xl leading-none text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <ul className="mt-4 space-y-1.5">
          {finding.vulnerabilities.map((v) => (
            <li key={v.id} className="flex items-start gap-2 text-sm">
              <SeverityBadge severity={v.severity} score={v.cvss} />
              <span>
                <a
                  href={vulnUrl(v.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs underline"
                >
                  {v.id}
                </a>{" "}
                {v.summary}
              </span>
            </li>
          ))}
        </ul>

        {!r ? (
          <p className="mt-6 text-sm text-zinc-500">
            Este escaneo no calculó soluciones. Versión mínima segura:{" "}
            {finding.minSafeVersion ?? "sin corrección"}.
          </p>
        ) : (
          <>
            <div
              className={`mt-6 rounded-lg border-l-4 p-3 ${
                r.status === "upgrade"
                  ? "border-green-600 bg-green-50 dark:bg-green-950/30"
                  : "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
              }`}
            >
              {r.status === "upgrade" ? (
                <p>
                  <strong>Recomendado:</strong> actualizar a{" "}
                  <code className="font-semibold">{r.recommended}</code>
                </p>
              ) : r.status === "no-fix" ? (
                <p>
                  <strong>No hay ninguna versión publicada libre de fallas conocidas.</strong> Aplica las
                  mitigaciones de abajo o evalúa reemplazar la librería.
                </p>
              ) : (
                <p>No se pudo calcular una versión segura (sin datos del registro).</p>
              )}
            </div>

            {r.options.length > 0 && (
              <Section title="Opciones de actualización">
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left text-sm">
                    <tbody>
                      {r.options.map((o) => (
                        <tr
                          key={o.kind}
                          className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                        >
                          <td className="p-2.5">{OPTION_LABEL[o.kind]}</td>
                          <td className="p-2.5">
                            <code className="font-semibold">{o.version}</code>
                            {o.version === r.recommended && (
                              <span className="ml-2 text-xs text-green-700 dark:text-green-400">
                                recomendada
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-xs">
                            {o.breaking ? (
                              <span className="font-semibold text-amber-600">
                                cambio de versión mayor: revisa el changelog
                              </span>
                            ) : (
                              <span className="text-zinc-500">compatible (misma versión mayor)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {r.safeVersions.length > 0 && (
              <Section title={`Todas las versiones seguras (${r.totalSafeVersions})`}>
                <p className="mb-2 text-xs text-zinc-500">
                  {r.verified
                    ? "Verificadas contra todos los avisos publicados de este paquete, no solo los de tu versión."
                    : "Lista parcial: calculada solo con las versiones corregidas de los avisos actuales."}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(showAll ? r.safeVersions : r.safeVersions.slice(0, 15)).map((v) => (
                    <code
                      key={v}
                      className={`rounded px-1.5 py-0.5 text-xs ${v === r.recommended ? "bg-green-100 font-semibold dark:bg-green-900/50" : "bg-zinc-100 dark:bg-zinc-800"}`}
                    >
                      {v}
                    </code>
                  ))}
                  {r.safeVersions.length > 15 && (
                    <button className="text-xs underline" onClick={() => setShowAll((x) => !x)}>
                      {showAll ? "ver menos" : `ver ${r.safeVersions.length - 15} más`}
                    </button>
                  )}
                </div>
                {r.totalSafeVersions > r.safeVersions.length && (
                  <p className="mt-1 text-xs text-zinc-500">
                    …y {r.totalSafeVersions - r.safeVersions.length} versiones más antiguas.
                  </p>
                )}
              </Section>
            )}

            {(r.commands.length > 0 || r.snippet) && (
              <Section title="Cómo aplicarlo">
                <ol className="list-decimal space-y-3 pl-5 text-sm">
                  {r.commands.map((c) => (
                    <li key={c.command + c.label}>
                      <p className="mb-1">{c.label}</p>
                      <CopyBlock text={c.command} />
                    </li>
                  ))}
                </ol>
                {r.snippet && (
                  <div className="mt-3 text-sm">
                    <p className="mb-1">
                      Fragmento para <code>{r.snippet.file}</code>:
                    </p>
                    <CopyBlock text={r.snippet.content} />
                    <p className="mt-1 text-xs text-zinc-500">{r.snippet.note}</p>
                  </div>
                )}
              </Section>
            )}

            {r.mitigations.length > 0 && (
              <Section title="Si vas a seguir usando esta versión">
                <p className="mb-2 text-xs text-zinc-500">
                  Medidas temporales para reducir el riesgo. No reemplazan la actualización.
                </p>
                <ul className="space-y-3">
                  {r.mitigations.map((m, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                    >
                      <p className="font-medium">
                        {m.title} <span className="text-xs font-normal text-zinc-500">({m.vulnId})</span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{m.text}</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {m.source === "advisory" ? "Del aviso oficial" : "Guía según el tipo de falla"}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {r.patches.length > 0 && (
              <Section title="Parches de la corrección">
                <ul className="space-y-1 text-sm">
                  {r.patches.map((p) => (
                    <li key={p.url} className="truncate">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 underline dark:text-blue-400"
                      >
                        {p.url}
                      </a>{" "}
                      <span className="text-xs text-zinc-500">({p.vulnId})</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {r.notes.length > 0 && (
              <Section title="Notas">
                <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                  {r.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
