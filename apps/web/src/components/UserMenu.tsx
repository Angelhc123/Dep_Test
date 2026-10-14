import { useEffect, useRef, useState } from "react";
import { startLogin, useLogout, useMe } from "../lib/auth";

export function UserMenu() {
  const me = useMe();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (me.isPending) return null;
  const data = me.data;
  if (!data || (!data.providers.google && !data.providers.github)) return null;

  if (!data.user) {
    return (
      <a
        href="#/login"
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Iniciar sesión
      </a>
    );
  }

  const u = data.user;
  const initial = (u.name ?? u.email ?? "?").slice(0, 1).toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {u.avatarUrl ? (
          <img src={u.avatarUrl} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
            {initial}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-xl border border-zinc-200 bg-white p-2 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="px-2 py-1.5">
            <div className="truncate font-medium">{u.name ?? "Usuario"}</div>
            {u.email && <div className="truncate text-xs text-zinc-500">{u.email}</div>}
            <div className="mt-1 text-xs text-zinc-500">
              Cuentas vinculadas: {data.linked.join(", ") || "ninguna"}
            </div>
          </div>
          <hr className="my-1 border-zinc-200 dark:border-zinc-800" />
          <a
            href="#/github"
            onClick={() => setOpen(false)}
            className="block rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Mis repos de GitHub
          </a>
          <a
            href="#/history"
            onClick={() => setOpen(false)}
            className="block rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Mi historial
          </a>
          {data.providers.github && !data.github.connected && (
            <button
              onClick={() => startLogin("github", "/#/github")}
              className="block w-full rounded px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Conectar GitHub
            </button>
          )}
          {data.providers.google && !data.linked.includes("google") && (
            <button
              onClick={() => startLogin("google")}
              className="block w-full rounded px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Vincular Google
            </button>
          )}
          <hr className="my-1 border-zinc-200 dark:border-zinc-800" />
          <button
            onClick={() => logout.mutate()}
            className="block w-full rounded px-2 py-1.5 text-left text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
