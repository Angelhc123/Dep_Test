import { Button, Card, ErrorBox, Spinner } from "../components/ui";
import { startLogin, useMe } from "../lib/auth";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}

export function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2.1c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
    </svg>
  );
}

export function Login({ error }: { error: string | null }) {
  const me = useMe();
  if (me.isPending) return <Spinner label="Cargando…" />;
  const providers = me.data?.providers ?? { google: false, github: false };
  const none = !providers.google && !providers.github;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Con una cuenta tu historial queda guardado en cualquier dispositivo. Con GitHub además puedes escanear
        tus repositorios privados.
      </p>
      {error && <ErrorBox error={error} />}
      {me.data?.user && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-200">
          Ya iniciaste sesión como {me.data.user.name ?? me.data.user.email}.
        </p>
      )}
      <Card className="space-y-3">
        <Button
          variant="secondary"
          className="w-full"
          disabled={!providers.google}
          onClick={() => startLogin("google", "/#/history")}
        >
          <GoogleIcon /> Continuar con Google
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          disabled={!providers.github}
          onClick={() => startLogin("github", "/#/github")}
        >
          <GithubIcon /> Continuar con GitHub
        </Button>
        {none && (
          <p className="text-xs text-zinc-500">
            El login todavía no está configurado en este servidor (faltan GOOGLE_CLIENT_ID /
            GITHUB_CLIENT_ID). Puedes seguir usando depscan sin cuenta.
          </p>
        )}
      </Card>
      <p className="text-xs text-zinc-500">
        GitHub pide permiso de lectura de repositorios (scope <code>repo</code>) para poder leer los
        manifiestos de repos privados. El token se guarda cifrado y puedes desconectarlo cuando quieras.
      </p>
    </div>
  );
}
