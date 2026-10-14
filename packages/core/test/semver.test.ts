import { describe, expect, it } from "vitest";
import { compareSemver, exactSemver, maxSatisfyingSemver, satisfiesSemver } from "../src/versions/semver.js";

describe("compareSemver", () => {
  it.each([
    ["1.0.0", "2.0.0", -1],
    ["1.2.3", "1.2.3", 0],
    ["1.10.0", "1.9.0", 1],
    ["1.0.0-alpha", "1.0.0", -1],
    ["1.0.0-alpha", "1.0.0-alpha.1", -1],
    ["1.0.0-alpha.1", "1.0.0-alpha.beta", -1],
    ["1.0.0-beta.2", "1.0.0-beta.11", -1],
    ["1.0.0-rc.1", "1.0.0", -1],
    ["v1.0.0", "1.0.0+build.5", 0],
  ])("%s vs %s → %i", (a, b, expected) => {
    expect(Math.sign(compareSemver(a, b))).toBe(expected);
  });
});

describe("satisfiesSemver", () => {
  it.each([
    ["4.17.21", "^4.17.0", true],
    ["5.0.0", "^4.17.0", false],
    ["0.2.5", "^0.2.3", true],
    ["0.3.0", "^0.2.3", false],
    ["0.0.4", "^0.0.3", false],
    ["1.2.9", "~1.2.3", true],
    ["1.3.0", "~1.2.3", false],
    ["1.9.9", "1.x", true],
    ["2.0.0", "1.x", false],
    ["1.5.0", "1.2.3 - 2.3.4", true],
    ["2.3.5", "1.2.3 - 2.3.4", false],
    ["2.3.9", "1.2.3 - 2.3", true],
    ["1.0.0", ">=1.0.0 <2.0.0 || >=3.0.0", true],
    ["2.5.0", ">=1.0.0 <2.0.0 || >=3.0.0", false],
    ["3.1.0", ">= 1.0.0 <2.0.0 || >=3.0.0", true],
    ["9.9.9", "*", true],
    ["9.9.9", "", true],
    ["1.2.0", ">1.1", true],
    ["1.1.9", ">1.1", false],
    ["1.2.3-beta.2", "^1.2.3-beta.1", true],
    ["1.3.0-beta.1", "^1.2.3-beta.1", false],
    ["2.0.0-rc.1", "^1.0.0", false],
  ])("%s satisface %s → %s", (v, range, expected) => {
    expect(satisfiesSemver(v, range)).toBe(expected);
  });

  it("rangos no semver devuelven false", () => {
    expect(satisfiesSemver("1.0.0", "github:user/repo")).toBe(false);
  });
});

describe("maxSatisfyingSemver / exactSemver", () => {
  it("elige la mayor versión estable dentro del rango", () => {
    expect(maxSatisfyingSemver(["4.16.0", "4.17.21", "4.18.0-beta.1", "5.0.0"], "^4.16.0")).toBe("4.17.21");
  });
  it("detecta versiones fijas", () => {
    expect(exactSemver("1.2.3")).toBe("1.2.3");
    expect(exactSemver("=1.2.3")).toBe("1.2.3");
    expect(exactSemver("^1.2.3")).toBeNull();
  });
});
