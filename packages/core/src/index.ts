export * from "./domain/types.js";
export * from "./versions/index.js";
export { parsePackageJson, nonRegistrySpec } from "./parsers/npm/package-json.js";
export { parseLockfile } from "./parsers/npm/lockfile.js";
export { parseRequirements, normalizePyName } from "./parsers/pypi/requirements.js";
export { resolveProject, type ResolveOptions, type ResolveResult } from "./resolver/resolve.js";
export * from "./sources/ports.js";
export { httpJson, HttpError, MemoryCache, RateLimiter, mapLimit } from "./sources/http.js";
export { OsvClient, OSV_BATCH_LIMIT } from "./sources/osv/osv-client.js";
export { NvdClient } from "./sources/nvd/nvd-client.js";
export { RegistryClient } from "./sources/registry/registry-client.js";
export { fetchGithubProject, parseGithubRepo, type GithubRepoRef } from "./sources/github/github-source.js";
export { readProjectDirectory, isManifestPath } from "./project/files.js";
export { cvss3BaseScore } from "./analysis/cvss.js";
export { isAffected, fixedVersions } from "./analysis/affected.js";
export { buildRemediation, type RemediationInput } from "./analysis/remediation.js";
export { cweGuidance, extractWorkaround } from "./analysis/cwe-guidance.js";
export {
  dedupe,
  minSafeVersion,
  normalizeVulnerability,
  shouldFail,
  summarize,
  type FailThreshold,
} from "./analysis/analyze.js";
export { scanProject, SCANNER_VERSION, type ScanOptions, type ScanSources } from "./scan.js";
export { renderHtml } from "./report/html.js";
export { renderText } from "./report/text.js";
