# ADR-010: Login con Google y GitHub (OAuth propio, sin librerías de auth)

- Estado: aceptada
- Fecha: 2026-10-13

## Contexto

Se pidió iniciar sesión con Google y con GitHub, e importar proyectos desde GitHub (incluidos los privados).

## Decisión

- Flujo OAuth 2.0 _authorization code_ implementado en `apps/api/src/auth/` con `fetch` nativo. `state` contra CSRF
  y PKCE (S256) en Google.
- Usuarios con varias identidades (`identities`): una cuenta puede tener Google y GitHub vinculados. Se vincula por
  email solo si el proveedor lo marca como verificado.
- Sesión: token aleatorio en cookie `HttpOnly`/`SameSite=Lax`/`Secure`. En la base se guarda solo su hash SHA-256 y
  se rota al iniciar sesión (evita la fijación de sesión).
- Solo se guarda el token de GitHub, cifrado con AES-256-GCM (clave derivada de `SESSION_SECRET`).
- GitHub usa el scope `repo` porque las OAuth Apps no tienen un scope de solo lectura para repos privados.
- Los escaneos tienen dueño (`user:<id>` o `anon:<sesión>`). Los de repos privados solo los ve su dueño. Al iniciar
  sesión, los escaneos anónimos de esa sesión pasan a la cuenta.

## Alternativas descartadas

- Passport / Auth.js: agregan dependencias y abstracciones para solo dos proveedores.
- GitHub App (permisos de solo lectura más finos): mejor a futuro, pero exige instalación por organización y más
  configuración. Queda como evolución.

## Consecuencias

- Sin `GOOGLE_*`/`GITHUB_*` la app funciona sin login (los botones se ocultan).
- Si cambia `SESSION_SECRET`, los tokens guardados dejan de servir y el usuario debe reconectar GitHub.
