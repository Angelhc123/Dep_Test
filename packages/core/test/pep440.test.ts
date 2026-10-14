import { describe, expect, it } from "vitest";
import { comparePep440, exactPep440, maxSatisfyingPep440, satisfiesPep440 } from "../src/versions/pep440.js";

describe("comparePep440", () => {
  // Orden canónico tomado de PEP 440 (sección "Summary of permitted suffixes and relative ordering").
  const ordered = [
    "1.0.dev456",
    "1.0a1",
    "1.0a2.dev456",
    "1.0a12.dev456",
    "1.0a12",
    "1.0b1.dev456",
    "1.0b2",
    "1.0b2.post345.dev456",
    "1.0b2.post345",
    "1.0rc1.dev456",
    "1.0rc1",
    "1.0",
    "1.0+abc.5",
    "1.0+abc.7",
    "1.0+5",
    "1.0.post456.dev34",
    "1.0.post456",
    "1.0.15",
    "1.1.dev1",
  ];
  it("respeta el orden de PEP 440", () => {
    for (let i = 0; i < ordered.length - 1; i++) {
      expect(comparePep440(ordered[i]!, ordered[i + 1]!), `${ordered[i]} < ${ordered[i + 1]}`).toBeLessThan(
        0,
      );
    }
  });
  it("normaliza formas equivalentes", () => {
    expect(comparePep440("1.0", "1.0.0")).toBe(0);
    expect(comparePep440("1.0alpha1", "1.0a1")).toBe(0);
    expect(comparePep440("1.0-1", "1.0.post1")).toBe(0);
    expect(comparePep440("1!0.5", "2.0")).toBeGreaterThan(0);
  });
});

describe("satisfiesPep440", () => {
  it.each([
    ["2.31.0", ">=2.0,<3", true],
    ["3.0", ">=2.0,<3", false],
    ["1.4.5", "~=1.4.2", true],
    ["1.5.0", "~=1.4.2", false],
    ["2.9", "~=2.2", true],
    ["3.0", "~=2.2", false],
    ["1.3.4", "==1.3.*", true],
    ["1.4.0", "==1.3.*", false],
    ["1.3.4", "!=1.3.*", false],
    ["3.0rc1", ">=2.0", false],
    ["3.0rc1", ">=3.0rc1", true],
    ["1.0.post1", ">1.0", false],
    ["1.0.1", ">1.0", true],
    ["2.0b1", "<2.0", false],
    ["1.0+local", "==1.0", true],
  ])("%s satisface %s → %s", (v, spec, expected) => {
    expect(satisfiesPep440(v, spec)).toBe(expected);
  });
});

describe("maxSatisfyingPep440 / exactPep440", () => {
  it("excluye pre-releases", () => {
    expect(maxSatisfyingPep440(["2.30.0", "2.31.0", "2.32.0rc1", "3.0.0"], ">=2.0,<3")).toBe("2.31.0");
  });
  it("detecta pines exactos", () => {
    expect(exactPep440("==2.31.0")).toBe("2.31.0");
    expect(exactPep440("==2.31.*")).toBeNull();
    expect(exactPep440(">=2.31")).toBeNull();
  });
});
