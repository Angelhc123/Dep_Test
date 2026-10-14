import { Card } from "../components/ui";

/** Cómo funciona y límites declarados (requisito del informe del proyecto). */
export function About() {
  const steps = [
    [
      "Leer manifiestos",
      "package.json, package-lock.json (v1/v2/v3) y requirements.txt (con -r, extras y marcadores).",
    ],
    [
      "Versión exacta",
      "Desde el lockfile. Sin lockfile: versión fija, estimación contra el registro o “no determinable”.",
    ],
    ["Consultar OSV", "POST /v1/querybatch en lotes de hasta 1000 paquetes; luego /v1/vulns/{id} con caché."],
    ["Enriquecer con NVD", "Opcional, solo por ID de CVE (CVSS oficial), respetando su límite de uso."],
    [
      "Lógica propia",
      "Deduplica CVE/GHSA/PYSEC, separa directas y transitivas, prioriza y calcula la versión mínima segura.",
    ],
    ["Reporte", "Semáforo, JSON y HTML; la CLI devuelve código de salida ≠ 0 para CI."],
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cómo funciona</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          depscan no descubre vulnerabilidades: cruza lo que tiene instalado un proyecto con lo que OSV y NVD
          ya publicaron.
        </p>
      </div>
      <ol className="space-y-3">
        {steps.map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              {i + 1}
            </span>
            <div>
              <div className="font-semibold">{title}</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">{text}</div>
            </div>
          </li>
        ))}
      </ol>
      <Card>
        <h2 className="mb-2 font-semibold">Limitaciones</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
          <li>
            Indica que una versión tiene una falla conocida, no si el código usa la función afectada: habrá
            alertas no explotables.
          </li>
          <li>Solo detecta lo ya publicado, no fallas desconocidas.</li>
          <li>Sin lockfile la precisión baja.</li>
          <li>Requiere internet y depende de la disponibilidad de OSV y NVD.</li>
        </ul>
      </Card>
    </div>
  );
}
