import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: api.me, staleTime: 60_000 });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      qc.clear();
      window.location.hash = "/";
    },
  });
}

/** Inicia OAuth: es una navegación completa (el proveedor redirige de vuelta a la app). */
export function startLogin(
  provider: "google" | "github",
  returnTo = window.location.pathname + window.location.hash,
) {
  window.location.href = api.loginUrl(provider, returnTo || "/#/");
}
