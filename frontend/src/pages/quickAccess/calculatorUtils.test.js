import {
  evaluateCalculatorExpression,
  formatCalculatorNumber,
  normalizeCalculatorExpression,
} from "./calculatorUtils";

describe("calculatorUtils", () => {
  it("normalizes display symbols into parser-friendly tokens", () => {
    expect(normalizeCalculatorExpression("2×(3+π)÷Ans")).toBe("2*(3+pi)/ans");
  });

  it("evaluates arithmetic and powers", () => {
    expect(evaluateCalculatorExpression("(2+3)^2")).toBe(25);
  });

  it("supports implicit multiplication and constants", () => {
    const value = evaluateCalculatorExpression("2π");
    expect(value).toBeCloseTo(2 * Math.PI);
  });

  it("supports factorial and percent", () => {
    expect(evaluateCalculatorExpression("5!")).toBe(120);
    expect(evaluateCalculatorExpression("250%")).toBe(2.5);
  });

  it("uses degree mode by default for trigonometry", () => {
    expect(evaluateCalculatorExpression("sin(30)")).toBeCloseTo(0.5, 8);
  });

  it("supports radian mode for trigonometry", () => {
    expect(
      evaluateCalculatorExpression("sin(pi/2)", {
        angleMode: "RAD",
      })
    ).toBeCloseTo(1, 8);
  });

  it("supports the running answer token", () => {
    expect(
      evaluateCalculatorExpression("Ans*4", {
        answer: 2.5,
      })
    ).toBeCloseTo(10);
  });

  it("throws a helpful error for invalid domains", () => {
    expect(() => evaluateCalculatorExpression("sqrt(-1)")).toThrow(
      "Square root is only defined for zero or positive values"
    );
  });

  it("formats large and tiny numbers cleanly", () => {
    expect(formatCalculatorNumber(1234.5)).toBe("1234.5");
    expect(formatCalculatorNumber(0.000000001234)).toBe("1.234e-9");
  });

  it("parses scientific notation when reusing formatted results", () => {
    expect(evaluateCalculatorExpression("1.234e-9 + 1")).toBeCloseTo(1.000000001234);
  });
});
