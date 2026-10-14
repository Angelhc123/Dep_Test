import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button, Card, ErrorBox, Spinner } from "../components/ui";
import { api, type GithubRepo } from "../lib/api";
import { startLogin, useMe } from "../lib/auth";
import { formatDate } from "../lib/format";
import { navigate } from "../lib/router";
import { GithubIcon } from "./Login";

function RepoRow({ repo }: { repo: GithubRepo }) {
  const [ref, setRef] = useState("");
  const qc = useQueryClient();
  const scan = useMutation({
    mutationFn: () =>
      api.createScan({ github: ref.trim() ? `${repo.fullName}@${ref.trim()}` : repo.fullName }),
    onSuccess: (report) => {
      qc.setQueryData(["scan", report.id], report);
      void qc.invalidateQueries({ queryKey: ["scans"] });
      navigate(`/scan/${report.id}`);
    },
  });
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline">
            {repo.fullName}
          </a>
          {repo.private && (
            <span className="rounded-full border border-amber-300 px-2 text-xs text-amber-700 dark:border-amber-800 dark:text-amber-300">
              privado
            </span>
          )}
          {repo.language && <span className="text-xs text-zinc-500">{repo.language}</span>}
        </div>
        {repo.description && <p className="truncate text-sm text-zinc-500">{repo.description}</p>}
        <p className="text-xs text-zinc-400">Actualizado {formatDate(repo.updatedAt)}</p>
        {scan.error && <p className="mt-1 text-sm text-red-600">{(scan.error as Error).message}</p>}
      </div>
      <input
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder={repo.defaultBranch}
        aria-label={`Rama, tag o commit de ${repo.fullName}`}
        className="w-32 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
      />
      <Button onClick={() => scan.mutate()} disabled={scan.isPending} className="min-w-28">
        {scan.isPending ? "Escaneando…" : "Escanear"}
      </Button>
    </li>
  );
}

/** Lista los repositorios de la cuenta de GitHub conectada para escanearlos con un clic. */
export function GithubRepos() {
  const me = useMe();
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const connected = me.data?.github.connected ?? false;
  const repos = useInfiniteQuery({
    queryKey: ["github-repos"],
    queryFn: ({ pageParam }) => api.githubRepos(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.hasMore ? all.length + 1 : undefined),
    enabled: connected,
  });
  const disconnect = useMutation({
    mutationFn: api.disconnectGithub,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      qc.removeQueries({ queryKey: ["github-repos"] });
    },
  });

  const list = useMemo(() => {
    const all = repos.data?.pages.flatMap((p) => p.repos) ?? [];
    const term = q.trim().toLowerCase();
    return term ? all.filter((r) => r.fullName.toLowerCase().includes(term)) : all;
  }, [repos.data, q]);

  if (me.isPending) return <Spinner label="Cargando…" />;
  if (!me.data?.providers.github) {
    return (
      <Card className="mx-auto max-w-xl">
        <p>
          La integración con GitHub no está configurada en este servidor (faltan GITHUB_CLIENT_ID y
          GITHUB_CLIENT_SECRET).
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Puedes escanear repos públicos desde{" "}
          <a className="underline" href="#/">
            Nuevo escaneo
          </a>
          .
        </p>
      </Card>
    );
  }
  if (!connected) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <GithubIcon className="mx-auto h-10 w-10" />
        <h1 className="mt-3 text-xl font-bold">Conecta tu cuenta de GitHub</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Verás tus repositorios (también los privados y los de tus organizaciones) y podrás escanearlos con
          un clic.
        </p>
        <Button className="mt-4" onClick={() => startLogin("github", "/#/github")}>
          <GithubIcon /> {me.data.user ? "Conectar GitHub" : "Continuar con GitHub"}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mis repositorios de GitHub</h1>
          <p className="text-sm text-zinc-500">
            Conectado como <strong>{me.data.github.login}</strong>
            {!me.data.github.canReadPrivate && " · sin permiso para repos privados"} ·{" "}
            <button className="underline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
              desconectar
            </button>
          </p>
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar repositorios…"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm sm:w-72 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {repos.isPending && <Spinner label="Cargando repositorios…" />}
      {repos.error && <ErrorBox error={repos.error} />}
      {repos.data && (
        <Card className="p-0">
          {list.length === 0 ? (
            <p className="p-6 text-center text-zinc-500">Ningún repositorio coincide.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {list.map((r) => (
                <RepoRow key={r.fullName} repo={r} />
              ))}
            </ul>
          )}
        </Card>
      )}
      {repos.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => void repos.fetchNextPage()}
          disabled={repos.isFetchingNextPage}
        >
          {repos.isFetchingNextPage ? "Cargando…" : "Cargar más"}
        </Button>
      )}
      <p className="text-xs text-zinc-500">
        Solo se descargan los manifiestos (package.json, package-lock.json, requirements*.txt). Los escaneos
        de repos privados solo los ves tú.
      </p>
    </div>
  );
}
