import { beforeEach, describe, expect, it } from "vitest";

import { fixedToString } from "@/lib/finance/fixed";
import { moneyToDecimalString } from "@/lib/finance/money";
import {
  GoalCurrencyMismatchError,
  calculateGoalProgress,
  canWithdrawFromGoal,
} from "@/lib/finance/goals";
import { makeGoal, makeGoalEntry, resetIds, try_, usd } from "../factories";

beforeEach(resetIds);

describe("progress", () => {
  const goal = makeGoal({ id: "g1", targetAmount: try_("50000") });

  it("reports an untouched goal as empty, not as zero progress", () => {
    const progress = calculateGoalProgress(goal, []);
    expect(progress.status).toBe("empty");
    expect(moneyToDecimalString(progress.saved)).toBe("0");
    expect(moneyToDecimalString(progress.remaining)).toBe("50000");
    expect(fixedToString(progress.ratio!)).toBe("0");
  });

  it("nets deposits against withdrawals", () => {
    const progress = calculateGoalProgress(goal, [
      makeGoalEntry({ goalId: "g1", amount: try_("12000") }),
      makeGoalEntry({ goalId: "g1", amount: try_("3500") }),
      makeGoalEntry({
        goalId: "g1",
        amount: try_("1500"),
        direction: "withdrawal",
      }),
    ]);
    expect(moneyToDecimalString(progress.saved)).toBe("14000");
    expect(moneyToDecimalString(progress.remaining)).toBe("36000");
    expect(fixedToString(progress.ratio!)).toBe("0.28");
    expect(progress.status).toBe("on-track");
    expect(progress.entryCount).toBe(3);
  });

  it("ignores entries belonging to other goals", () => {
    const progress = calculateGoalProgress(goal, [
      makeGoalEntry({ goalId: "g1", amount: try_("1000") }),
      makeGoalEntry({ goalId: "other", amount: try_("9999") }),
    ]);
    expect(moneyToDecimalString(progress.saved)).toBe("1000");
  });

  it("clamps remaining at zero once reached and does not go negative", () => {
    const progress = calculateGoalProgress(goal, [
      makeGoalEntry({ goalId: "g1", amount: try_("52000") }),
    ]);
    expect(progress.status).toBe("reached");
    expect(moneyToDecimalString(progress.remaining)).toBe("0");
    expect(fixedToString(progress.ratio!)).toBe("1.04");
  });

  it("treats a non-positive target as invalid instead of dividing by zero", () => {
    const zeroGoal = makeGoal({ id: "g2", targetAmount: try_("0") });
    const progress = calculateGoalProgress(zeroGoal, [
      makeGoalEntry({ goalId: "g2", amount: try_("100") }),
    ]);
    expect(progress.ratio).toBeNull();
    expect(progress.status).toBe("invalid");
    expect(moneyToDecimalString(progress.saved)).toBe("100");
  });

  it("refuses to mix currencies within one goal", () => {
    expect(() =>
      calculateGoalProgress(goal, [
        makeGoalEntry({ goalId: "g1", amount: usd("500") }),
      ]),
    ).toThrow(GoalCurrencyMismatchError);
  });
});

describe("withdrawal guard", () => {
  const goal = makeGoal({ id: "g1", targetAmount: try_("50000") });
  const progress = calculateGoalProgress(goal, [
    makeGoalEntry({ goalId: "g1", amount: try_("2000") }),
  ]);

  it("allows withdrawing up to the saved amount", () => {
    expect(canWithdrawFromGoal(progress, try_("2000"))).toBe(true);
    expect(canWithdrawFromGoal(progress, try_("1"))).toBe(true);
  });

  it("rejects overdrawing, zero, negative and foreign currency", () => {
    expect(canWithdrawFromGoal(progress, try_("2000.01"))).toBe(false);
    expect(canWithdrawFromGoal(progress, try_("0"))).toBe(false);
    expect(canWithdrawFromGoal(progress, try_("-50"))).toBe(false);
    expect(canWithdrawFromGoal(progress, usd("1"))).toBe(false);
  });
});
