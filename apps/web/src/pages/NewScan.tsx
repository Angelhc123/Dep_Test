import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type DragEvent } from "react";
import { Button, Card, ErrorBox, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { readManifests, type PickedFile } from "../lib/manifests";
import { navigate } from "../lib/router";

type Mode = "upload" | "github";

export function NewScan() {
  const [mode, setMode] = useState<Mode>("upload");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [estimate, setEstimate] = useState(false);
  const [enrichNvd, setEnrichNvd] = useState(false);
  const [includeDev, setIncludeDev] = useState(true);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, staleTime: 60_000 });

  const scan = useMutation({
    mutationFn: () =>
      api.createScan({
        ...(mode === "github"
          ? { github: repo.trim() }
          : { name: name.trim() || undefined, files: files.map(({ path, content }) => ({ path, content })) }),
        options: { estimate, enrichNvd, includeDev },
      }),
    onSuccess: (report) => {
      qc.setQueryData(["scan", report.id], report);
      void qc.invalidateQueries({ queryKey: ["scans"] });
      navigate(`/scan/${report.id}`);
    },
  });

  async function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const { files: picked, skipped: s } = await readManifests(list);
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [f.path, f]));
      for (const f of picked) map.set(f.path, f);
      return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
    });
    setSkipped((x) => x + s);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  }

  const canScan = mode === "github" ? repo.trim().length > 2 : files.length > 0;
  const hasLock = files.some((f) => /package-lock\.json|npm-shrinkwrap\.json$/.test(f.path));
  const hasPkg = files.some((f) => f.path.endsWith("package.json"));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Nuevo escaneo</h1>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
        Analiza <code>package.json</code>, <code>package-lock.json</code> y <code>requirements.txt</code>{" "}
        contra las bases públicas OSV y NVD.
      </p>

      <div
        className="mt-6 inline-flex rounded-lg border border-zinc-300 p-1 dark:border-zinc-700"
        role="tablist"
      >
        {(
          [
            ["upload", "Subir archivos"],
            ["github", "Repositorio de GitHub"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === m
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="mt-4">
        {mode === "upload" ? (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`rounded-lg border-2 border-dashed p-8 text-center transition ${
                dragging
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              <p className="font-medium">Arrastra aquí los archivos del proyecto</p>
              <p className="mt-1 text-sm text-zinc-500">
                Se ignoran node_modules, venv y cualquier archivo que no sea un manifiesto.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                  Elegir archivos
                </Button>
                <Button variant="secondary" onClick={() => dirInput.current?.click()}>
                  Elegir carpeta
                </Button>
              </div>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                accept=".json,.txt"
                onChange={(e) => void addFiles(e.target.files)}
              />
              <input
                ref={dirInput}
                type="file"
                hidden
                // @ts-expect-error atributo no estándar soportado por Chrome, Edge y Firefox
                webkitdirectory=""
                onChange={(e) => void addFiles(e.target.files)}
              />
            </div>

            {files.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{files.length} manifiesto(s)</span>
                  <button
                    className="text-zinc-500 hover:underline"
                    onClick={() => {
                      setFiles([]);
                      setSkipped(0);
                    }}
                  >
                    Quitar todos
                  </button>
                </div>
                <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
                  {files.map((f) => (
                    <li key={f.path} className="flex items-center justify-between gap-2 px-3 py-2">
                      <code className="truncate">{f.path}</code>
                      <span className="flex shrink-0 items-center gap-3 text-zinc-500">
                        {(f.size / 1024).toFixed(1)} KB
                        <button
                          aria-label={`Quitar ${f.path}`}
                          onClick={() => setFiles(files.filter((x) => x !== f))}
                          className="hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                {skipped > 0 && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {skipped} archivo(s) ignorados por no ser manifiestos.
                  </p>
                )}
                {hasPkg && !hasLock && (
                  <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    Sin <code>package-lock.json</code> las versiones exactas no se pueden garantizar. Súbelo o
                    activa la estimación.
                  </p>
                )}
              </div>
            )}

            <label className="block text-sm">
              <span className="font-medium">Nombre del proyecto (opcional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </div>
        ) : (
          <label className="block text-sm">
            <span className="font-medium">Repositorio público</span>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="expressjs/express  ·  https://github.com/owner/repo/tree/v1.2.0"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              Se descargan solo los manifiestos y se registra el commit exacto para que el escaneo sea
              reproducible. ¿Repo privado? Usa{" "}
              <a href="#/github" className="underline">
                Mis repos de GitHub
              </a>
              .
            </span>
          </label>
        )}

        <fieldset className="mt-5 space-y-2 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
          <legend className="sr-only">Opciones</legend>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={includeDev}
              onChange={(e) => setIncludeDev(e.target.checked)}
            />
            <span>Incluir dependencias de desarrollo</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={estimate}
              onChange={(e) => setEstimate(e.target.checked)}
            />
            <span>
              Estimar versiones sin lockfile
              <span className="block text-xs text-zinc-500">
                Usa la versión más alta publicada que cumple el rango (se marca como estimación).
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={enrichNvd}
              onChange={(e) => setEnrichNvd(e.target.checked)}
            />
            <span>
              Enriquecer con NVD (CVSS oficial)
              <span className="block text-xs text-zinc-500">
                {health.data?.nvdApiKey
                  ? "Con API key: hasta 50 consultas cada 30 s."
                  : "Sin API key: 5 consultas cada 30 s, puede tardar."}
              </span>
            </span>
          </label>
        </fieldset>

        <div className="mt-5 flex items-center gap-4">
          <Button disabled={!canScan || scan.isPending} onClick={() => scan.mutate()}>
            {scan.isPending ? "Escaneando…" : "Escanear"}
          </Button>
          {scan.isPending && <Spinner label={enrichNvd ? "Consultando OSV y NVD…" : "Consultando OSV…"} />}
        </div>
        {scan.error && (
          <div className="mt-4">
            <ErrorBox error={scan.error} />
          </div>
        )}
      </Card>
    </div>
  );
}
