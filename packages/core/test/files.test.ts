import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isIgnoredPath,
  isManifestPath,
  isRequirementsFile,
  readProjectDirectory,
} from "../src/project/files.js";

describe("isIgnoredPath", () => {
  it("ignora rutas dentro de node_modules o .git", () => {
    expect(isIgnoredPath("node_modules/foo/package.json")).toBe(true);
    expect(isIgnoredPath(".git/config")).toBe(true);
  });

  it("no ignora rutas normales", () => {
    expect(isIgnoredPath("src/index.ts")).toBe(false);
  });
});

describe("isRequirementsFile", () => {
  it("detecta requirements.txt y variantes", () => {
    expect(isRequirementsFile("requirements.txt")).toBe(true);
    expect(isRequirementsFile("requirements-dev.txt")).toBe(true);
    expect(isRequirementsFile("requirements/base.txt")).toBe(true);
    expect(isRequirementsFile("dev-requirements.txt")).toBe(true);
  });

  it("rechaza archivos .txt no relacionados", () => {
    expect(isRequirementsFile("notes.txt")).toBe(false);
    expect(isRequirementsFile("requirements.cfg")).toBe(false);
  });
});

describe("isManifestPath", () => {
  it("acepta manifiestos npm y requirements", () => {
    expect(isManifestPath("package.json")).toBe(true);
    expect(isManifestPath("package-lock.json")).toBe(true);
    expect(isManifestPath("npm-shrinkwrap.json")).toBe(true);
    expect(isManifestPath("requirements.txt")).toBe(true);
  });

  it("rechaza manifiestos dentro de directorios ignorados", () => {
    expect(isManifestPath("node_modules/x/package.json")).toBe(false);
  });

  it("rechaza archivos que no son manifiestos", () => {
    expect(isManifestPath("README.md")).toBe(false);
  });
});

describe("readProjectDirectory", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "depscan-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("lee manifiestos recursivamente e ignora node_modules y archivos irrelevantes", async () => {
    await writeFile(join(dir, "package.json"), '{"name":"root"}');
    await mkdir(join(dir, "src"));
    await writeFile(join(dir, "src", "requirements.txt"), "flask==2.0.0");
    await writeFile(join(dir, "README.md"), "# hola");
    await mkdir(join(dir, "node_modules", "x"), { recursive: true });
    await writeFile(join(dir, "node_modules", "x", "package.json"), "{}");
    await mkdir(join(dir, ".git"));
    await writeFile(join(dir, ".git", "config"), "");

    const files = await readProjectDirectory(dir);
    expect([...files.keys()].sort()).toEqual(["package.json", "src/requirements.txt"]);
    expect(files.get("package.json")).toBe('{"name":"root"}');
  });

  it("respeta el límite maxFiles", async () => {
    await writeFile(join(dir, "package.json"), "{}");
    await writeFile(join(dir, "requirements.txt"), "x==1");
    const files = await readProjectDirectory(dir, 1);
    expect(files.size).toBe(1);
  });

  it("ignora directorios inaccesibles sin lanzar", async () => {
    const files = await readProjectDirectory(join(dir, "no-existe"));
    expect(files.size).toBe(0);
  });

  it("ignora carpetas ocultas", async () => {
    await mkdir(join(dir, ".hidden"));
    await writeFile(join(dir, ".hidden", "package.json"), "{}");
    const files = await readProjectDirectory(dir);
    expect(files.size).toBe(0);
  });
});
