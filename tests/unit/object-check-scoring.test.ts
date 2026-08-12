import { describe, expect, it } from "vitest";
import {
  buildAnswersForScore,
  evaluateObjectCheck,
  OBJECT_CHECK_QUESTIONS,
  type ObjectCheckAnswers,
} from "../../app/src/features/objectCheck/objectCheck";

function answersWithTotal(target: number): ObjectCheckAnswers {
  const answers = buildAnswersForScore(0);
  let remaining = target;

  for (const question of OBJECT_CHECK_QUESTIONS) {
    const score = Math.min(2, remaining);
    const option = question.options.find((entry) => entry.score === score);
    if (!option) throw new Error(`Testoption mit Wert ${score} fehlt`);
    answers[question.id] = option.value;
    remaining -= score;
  }

  return answers;
}

describe("ObjektCheck scoring", () => {
  it.each([
    [0, "Strukturiert betreut"],
    [3, "Strukturiert betreut"],
    [4, "Punktueller Optimierungsbedarf"],
    [7, "Punktueller Optimierungsbedarf"],
    [8, "Erhöhter Betreuungsbedarf"],
    [11, "Erhöhter Betreuungsbedarf"],
    [12, "Strukturaufbau empfohlen"],
    [16, "Strukturaufbau empfohlen"],
  ] as const)("ordnet %i Punkte der Kategorie %s zu", (total, category) => {
    const result = evaluateObjectCheck(answersWithTotal(total));
    expect(result.total).toBe(total);
    expect(result.category).toBe(category);
  });

  it("liefert vier Bereichswerte und drei passende Empfehlungen", () => {
    const result = evaluateObjectCheck(buildAnswersForScore(2));
    expect(Object.keys(result.areas)).toHaveLength(4);
    expect(result.recommendations).toHaveLength(3);
    expect(new Set(result.recommendations).size).toBe(3);
  });

  it("lehnt einen unvollständigen Durchlauf ab", () => {
    expect(() => evaluateObjectCheck({})).toThrow("Unvollständige Antwort");
  });
});
