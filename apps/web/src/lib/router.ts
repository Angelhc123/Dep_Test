import { useEffect, useState } from "react";

/** Enrutado mínimo por hash (#/scan/123): no necesita configuración en el servidor. */
export type Route =
  | { page: "new" }
  | { page: "scan"; id: string }
  | { page: "history" }
  | { page: "compare"; a: string; b: string }
  | { page: "github" }
  | { page: "login"; error: string | null }
  | { page: "about" };

export function parseRoute(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(query);
  if (parts[0] === "scan" && parts[1]) return { page: "scan", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "history") return { page: "history" };
  if (parts[0] === "compare") return { page: "compare", a: params.get("a") ?? "", b: params.get("b") ?? "" };
  if (parts[0] === "github") return { page: "github" };
  if (parts[0] === "login") return { page: "login", error: params.get("error") };
  if (parts[0] === "about") return { page: "about" };
  return { page: "new" };
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
