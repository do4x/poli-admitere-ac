import { describe, expect, it } from "vitest";
import {
  archetypeFor,
  computeDRaw,
  grade,
  isBandMargin,
  levelFor,
  levelLabel,
  meetsMinLevel,
  starSlots,
  type Archetype,
  type DifficultyLevel,
  type DifficultyScores,
} from "./difficulty";

/**
 * The calibration set of DIFICULTATE.md §11 (preadmitere 2025 varianta A plus
 * the ARB(n) 5★ anchor). Reproducing it exactly is the acceptance test for the
 * scoring engine — if a formula or threshold drifts, one of these rows breaks.
 */
const CALIBRATION: {
  id: string;
  scores: DifficultyScores;
  dRaw: number;
  level: DifficultyLevel;
  bandMargin: boolean;
  archetype: Archetype;
}[] = [
  {
    id: "P1 √(6x−8) = x",
    scores: { r: 1, e: 1.5, t: 0, p: 0, k: 0, v: -0.5 },
    dRaw: 1.0,
    level: 0.5,
    bandMargin: false,
    archetype: "TRIVIAL",
  },
  {
    id: "P2 3x+1 > 2x+2",
    scores: { r: 1, e: 1, t: 0, p: 0, k: 0, v: -0.5 },
    dRaw: 0.5,
    level: 0.5,
    bandMargin: false,
    archetype: "TRIVIAL",
  },
  {
    id: "P3 log_a b = 4/3",
    scores: { r: 4, e: 2, t: 0.5, p: 0.5, k: 0.25, v: -0.25 },
    dRaw: 5.4,
    level: 3.5,
    bandMargin: true,
    archetype: "INSIGHT",
  },
  {
    id: "P4 det(A) = 1",
    scores: { r: 1, e: 2, t: 0.25, p: 0, k: 0, v: -0.5 },
    dRaw: 1.75,
    level: 1,
    bandMargin: false,
    archetype: "TRIVIAL",
  },
  {
    id: "P5 3^(x²+4x+6) = 27",
    scores: { r: 2, e: 2, t: 0.25, p: 0, k: 0, v: -0.5 },
    dRaw: 2.15,
    level: 1.5,
    bandMargin: true,
    archetype: "STANDARD",
  },
  {
    id: "P6 tangentă comună",
    scores: { r: 3, e: 3, t: 0.5, p: 0.25, k: 0, v: -0.5 },
    dRaw: 4.05,
    level: 3,
    bandMargin: true,
    archetype: "STANDARD",
  },
  {
    id: "P7 sistem parametric incompatibil",
    scores: { r: 2, e: 4, t: 0.75, p: 0.25, k: 0, v: 0.25 },
    dRaw: 5.65,
    level: 4,
    // The §11 table prints "—" here, but 5.65 is exactly 0.15 above the
    // 5.50 boundary — the same distance that earns P5 and P6 their ⚠ in the
    // very same table. The stated rule (§5) wins over the typo.
    bandMargin: true,
    archetype: "GRIND",
  },
  {
    id: "P8 Viète",
    scores: { r: 3, e: 3, t: 0.5, p: 0, k: 0, v: -0.25 },
    dRaw: 4.05,
    level: 3,
    bandMargin: true,
    archetype: "STANDARD",
  },
  {
    id: "P9 ecuație integrală",
    scores: { r: 4, e: 3.5, t: 0.5, p: 0, k: 0.25, v: 0.25 },
    dRaw: 6.0,
    level: 4,
    bandMargin: false,
    archetype: "BRUTAL",
  },
  {
    id: "P10 progresie aritmetică",
    scores: { r: 2, e: 2, t: 0.25, p: 0, k: 0, v: -0.25 },
    dRaw: 2.4,
    level: 1.5,
    bandMargin: false,
    archetype: "STANDARD",
  },
  {
    id: "ARB(n) — ancora de 5★",
    scores: { r: 5, e: 5, t: 1, p: 0.5, k: 0.5, v: -0.5 },
    dRaw: 8.1,
    level: 5,
    bandMargin: false,
    archetype: "BRUTAL",
  },
];

describe("calibration set (DIFICULTATE.md §11)", () => {
  for (const row of CALIBRATION) {
    it(`reproduces ${row.id}`, () => {
      const graded = grade(row.scores);
      expect(graded.dRaw).toBe(row.dRaw);
      expect(graded.level).toBe(row.level);
      expect(graded.bandMargin).toBe(row.bandMargin);
      expect(graded.archetype).toBe(row.archetype);
    });
  }
});

describe("computeDRaw", () => {
  it("lets the dominant axis set the ceiling", () => {
    // Same pair, swapped: the formula is symmetric in R and E.
    expect(computeDRaw({ r: 5, e: 1, t: 0, p: 0, k: 0, v: 0 })).toBe(
      computeDRaw({ r: 1, e: 5, t: 0, p: 0, k: 0, v: 0 }),
    );
  });

  it("adds the secondary axis sublinearly", () => {
    const low = computeDRaw({ r: 4, e: 1, t: 0, p: 0, k: 0, v: 0 });
    const high = computeDRaw({ r: 4, e: 4, t: 0, p: 0, k: 0, v: 0 });
    expect(low).toBe(4);
    expect(high).toBe(5.2); // +1.2, not +4
  });

  it("spans the documented range", () => {
    expect(computeDRaw({ r: 1, e: 1, t: 0, p: 0, k: 0, v: -0.5 })).toBe(0.5);
    expect(computeDRaw({ r: 5, e: 5, t: 1, p: 0.5, k: 0.5, v: 0.5 })).toBe(9.1);
  });

  it("rounds to two decimals so float dust never picks a band", () => {
    expect(computeDRaw({ r: 3.5, e: 2.5, t: 0.25, p: 0, k: 0, v: 0 })).toBe(
      4.35,
    );
  });
});

describe("levelFor", () => {
  it("maps each band boundary to the lower band", () => {
    const boundaries: [number, DifficultyLevel][] = [
      [1.25, 0.5],
      [1.26, 1],
      [2.0, 1],
      [2.01, 1.5],
      [2.6, 1.5],
      [2.61, 2],
      [3.2, 2],
      [3.21, 2.5],
      [3.9, 2.5],
      [3.91, 3],
      [4.6, 3],
      [4.61, 3.5],
      [5.5, 3.5],
      [5.51, 4],
      [6.4, 4],
      [6.41, 4.5],
      [7.75, 4.5],
      [7.76, 5],
    ];
    for (const [dRaw, level] of boundaries) {
      expect(levelFor(dRaw), `D_raw ${dRaw}`).toBe(level);
    }
  });

  it("clamps the extremes", () => {
    expect(levelFor(0.5)).toBe(0.5);
    expect(levelFor(9.1)).toBe(5);
  });
});

describe("isBandMargin", () => {
  it("flags scores within 0.15 of a boundary, on either side", () => {
    expect(isBandMargin(5.4)).toBe(true); // 0.10 below 5.50
    expect(isBandMargin(5.65)).toBe(true); // 0.15 above 5.50
    expect(isBandMargin(5.66)).toBe(false); // 0.16 above
  });

  it("leaves mid-band scores alone", () => {
    expect(isBandMargin(6.0)).toBe(false);
    expect(isBandMargin(8.1)).toBe(false);
  });
});

describe("archetypeFor", () => {
  it("prefers BRUTAL over INSIGHT when both would match", () => {
    // R−E = 1.5 would be INSIGHT, but the BRUTAL gate fires first.
    expect(archetypeFor({ r: 5, e: 3.5, t: 0 }, 4.5)).toBe("BRUTAL");
  });

  it("keeps a hard-to-see problem out of BRUTAL below level 4", () => {
    expect(archetypeFor({ r: 4, e: 3.5, t: 0 }, 3.5)).toBe("STANDARD");
  });

  it("calls a trap a trap only when both axes are cheap", () => {
    expect(archetypeFor({ r: 2, e: 3, t: 0.5 }, 2.5)).toBe("TRAP");
    expect(archetypeFor({ r: 2.5, e: 3, t: 0.5 }, 2.5)).toBe("STANDARD");
  });

  it("never calls a trap-laden easy problem TRIVIAL", () => {
    expect(archetypeFor({ r: 1, e: 1, t: 0.5 }, 1)).toBe("TRAP");
    expect(archetypeFor({ r: 1, e: 1, t: 0.25 }, 1)).toBe("TRIVIAL");
  });
});

describe("meetsMinLevel", () => {
  it("passes everything when no minimum is set", () => {
    expect(meetsMinLevel(null, undefined)).toBe(true);
    expect(meetsMinLevel({ level: 1 }, undefined)).toBe(true);
  });

  it("excludes ungraded problems once a minimum is set", () => {
    expect(meetsMinLevel(null, 1)).toBe(false);
    expect(meetsMinLevel(undefined, 0.5)).toBe(false);
  });

  it("compares against the label", () => {
    expect(meetsMinLevel({ level: 3.5 }, 3.5)).toBe(true);
    expect(meetsMinLevel({ level: 3 }, 3.5)).toBe(false);
  });

  it("promotes a band-margin problem one half-star, per §5", () => {
    expect(meetsMinLevel({ level: 3.5, bandMargin: true }, 4)).toBe(true);
    expect(meetsMinLevel({ level: 3.5, bandMargin: false }, 4)).toBe(false);
  });
});

describe("star rendering", () => {
  it("splits a level into five slots", () => {
    expect(starSlots(3.5)).toEqual(["full", "full", "full", "half", "empty"]);
    expect(starSlots(5)).toEqual(Array(5).fill("full"));
    expect(starSlots(0.5)).toEqual([
      "half",
      "empty",
      "empty",
      "empty",
      "empty",
    ]);
  });

  it("labels levels compactly", () => {
    expect(levelLabel(0.5)).toBe("½★");
    expect(levelLabel(3)).toBe("3★");
    expect(levelLabel(4.5)).toBe("4½★");
  });
});
