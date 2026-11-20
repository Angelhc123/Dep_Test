// Datos deterministas para las pruebas de sistema, UI y aceptación.
// Simulan las respuestas de OSV y de los registros npm/PyPI para que las pruebas
// no dependan de internet ni cambien cuando se publiquen nuevas vulnerabilidades.
import { isAffected } from "../../packages/core/dist/index.js";

/** @type {import('@depscan/core').OsvVulnerability[]} */
export const VULNS = [
  {
    id: "GHSA-demo-lodash",
    aliases: ["CVE-2021-23337"],
    summary: "Inyección de comandos en lodash.template",
    details: "### Workarounds\nNo pases plantillas controladas por el usuario a `template`.",
    database_specific: { severity: "HIGH", cwe_ids: ["CWE-77"] },
    affected: [
      {
        package: { name: "lodash", ecosystem: "npm" },
        ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.21" }] }],
      },
    ],
  },
  {
    id: "GHSA-demo-django",
    aliases: ["CVE-2023-31047"],
    summary: "Validación incompleta de archivos subidos en Django",
    details: "Actualiza a una versión corregida.",
    database_specific: { severity: "CRITICAL", cwe_ids: ["CWE-20"] },
    affected: [
      {
        package: { name: "django", ecosystem: "PyPI" },
        ranges: [{ type: "ECOSYSTEM", events: [{ introduced: "0" }, { fixed: "3.2.19" }] }],
      },
    ],
  },
];

const VERSIONS = {
  "npm:lodash": ["4.17.15", "4.17.19", "4.17.20", "4.17.21"],
  "npm:express": ["4.18.2", "4.19.2"],
  "PyPI:django": ["3.2.0", "3.2.18", "3.2.19", "4.2.0"],
};

const byPackage = (ecosystem, name) =>
  VULNS.filter((v) =>
    v.affected.some((a) => a.package.ecosystem === ecosystem && a.package.name === name.toLowerCase()),
  );

/** Fuentes simuladas que cumplen los puertos VulnSource y RegistrySource del core. */
export const fuentesSimuladas = {
  osv: {
    // Como el querybatch real de OSV: solo devuelve avisos que afectan a ESA versión.
    queryBatch: async (qs) =>
      qs.map((q) =>
        byPackage(q.ecosystem, q.name)
          .filter((v) => isAffected(q.version, v.affected, q.ecosystem))
          .map((v) => v.id),
      ),
    getVulnerability: async (id) => VULNS.find((v) => v.id === id) ?? null,
    queryPackage: async (name, ecosystem) => byPackage(ecosystem ?? "npm", name),
  },
  registry: {
    listVersions: async (ecosystem, name) => VERSIONS[`${ecosystem}:${name.toLowerCase()}`] ?? null,
  },
};
