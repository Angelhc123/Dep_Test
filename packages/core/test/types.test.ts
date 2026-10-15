import { describe, expect, it } from "vitest";
import { severityFromScore, severityRank, type Severity } from "../src/domain/types.js";

describe("severityRank", () => {
  it("ordena de mayor a menor gravedad: critical > high > medium > unknown > low", () => {
    const order: Severity[] = ["critical", "high", "medium", "unknown", "low"];
    for (let i = 0; i < order.length - 1; i++) {
      expect(severityRank(order[i]!)).toBeGreaterThan(severityRank(order[i + 1]!));
    }
  });
});

describe("severityFromScore", () => {
  it("clasifica según los umbrales de CVSS", () => {
    expect(severityFromScore(9.5)).toBe("critical");
    expect(severityFromScore(9)).toBe("critical");
    expect(severityFromScore(7)).toBe("high");
    expect(severityFromScore(8.9)).toBe("high");
    expect(severityFromScore(4)).toBe("medium");
    expect(severityFromScore(6.9)).toBe("medium");
    expect(severityFromScore(0.1)).toBe("low");
    expect(severityFromScore(3.9)).toBe("low");
    expect(severityFromScore(0)).toBe("unknown");
  });
});
