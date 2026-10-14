import { UserMenu } from "./components/UserMenu";
import { About } from "./pages/About";
import { Compare } from "./pages/Compare";
import { GithubRepos } from "./pages/GithubRepos";
import { History } from "./pages/History";
import { Login } from "./pages/Login";
import { NewScan } from "./pages/NewScan";
import { ScanResult } from "./pages/ScanResult";
import { useRoute } from "./lib/router";

const NAV = [
  ["#/", "Nuevo escaneo", "new"],
  ["#/github", "Mis repos de GitHub", "github"],
  ["#/history", "Historial", "history"],
  ["#/about", "Cómo funciona", "about"],
] as const;

export function App() {
  const route = useRoute();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <a href="#/" className="flex items-center gap-2 font-bold">
            <span className="flex gap-0.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
            </span>
            depscan
          </a>
          <nav className="flex gap-4 text-sm">
            {NAV.map(([href, label, page]) => (
              <a
                key={href}
                href={href}
                className={
                  route.page === page
                    ? "font-semibold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {route.page === "new" && <NewScan />}
        {route.page === "scan" && <ScanResult id={route.id} />}
        {route.page === "history" && <History />}
        {route.page === "compare" && <Compare a={route.a} b={route.b} />}
        {route.page === "github" && <GithubRepos />}
        {route.page === "login" && <Login error={route.error} />}
        {route.page === "about" && <About />}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-zinc-500">
        Datos de{" "}
        <a className="underline" href="https://osv.dev" target="_blank" rel="noreferrer">
          OSV
        </a>{" "}
        y{" "}
        <a className="underline" href="https://nvd.nist.gov" target="_blank" rel="noreferrer">
          NVD
        </a>
        .
      </footer>
    </div>
  );
}
