import { useEffect, useEffectEvent, useState } from "react";

import QuickAccessLayout from "../../components/QuickAccessLayout";
import {
  evaluateCalculatorExpression,
  formatCalculatorNumber,
} from "./calculatorUtils";
import "./CalculatorPage.css";

const BUTTON_ROWS = [
  [
    { label: "AC", action: "clear", tone: "danger" },
    { label: "+/-", action: "sign", tone: "utility" },
    { label: "%", action: "percent", tone: "utility" },
    { label: "\u00f7", action: "operator", value: "/", tone: "operator" },
  ],
  [
    { label: "7", action: "digit", value: "7", tone: "number" },
    { label: "8", action: "digit", value: "8", tone: "number" },
    { label: "9", action: "digit", value: "9", tone: "number" },
    { label: "\u00d7", action: "operator", value: "*", tone: "operator" },
  ],
  [
    { label: "4", action: "digit", value: "4", tone: "number" },
    { label: "5", action: "digit", value: "5", tone: "number" },
    { label: "6", action: "digit", value: "6", tone: "number" },
    { label: "\u2212", action: "operator", value: "-", tone: "operator" },
  ],
  [
    { label: "1", action: "digit", value: "1", tone: "number" },
    { label: "2", action: "digit", value: "2", tone: "number" },
    { label: "3", action: "digit", value: "3", tone: "number" },
    { label: "+", action: "operator", value: "+", tone: "operator" },
  ],
  [
    {
      label: "0",
      action: "digit",
      value: "0",
      tone: "number",
      className: "tg-calculator-key--wide",
    },
    { label: ".", action: "decimal", tone: "number" },
    { label: "=", action: "equals", tone: "equals" },
  ],
];

const TRAILING_NUMBER_PATTERN = /-?(?:\d+\.?\d*|\.\d+)$/;
const TRAILING_OPERATOR_PATTERN = /[+\-*/]$/;

function formatExpression(expression = "") {
  return String(expression)
    .replace(/\*/g, " \u00d7 ")
    .replace(/\//g, " \u00f7 ")
    .replace(/\+/g, " + ")
    .replace(/-/g, "\u2212")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDisplayFromExpression(expression = "") {
  const current = String(expression || "");

  if (!current) {
    return "0";
  }

  if (current === "-") {
    return "-0";
  }

  const trimmedExpression = TRAILING_OPERATOR_PATTERN.test(current)
    ? current.slice(0, -1)
    : current;
  const lastNumber = trimmedExpression.match(TRAILING_NUMBER_PATTERN)?.[0];

  return lastNumber || "0";
}

function replaceTrailingNumber(expression, nextNumber) {
  const match = String(expression || "").match(TRAILING_NUMBER_PATTERN);
  if (!match || match.index === undefined) {
    return expression;
  }

  return `${expression.slice(0, match.index)}${nextNumber}`;
}

function createClearedState() {
  return {
    rawExpression: "",
    display: "0",
    expressionLabel: "",
    justEvaluated: false,
  };
}

function createExpressionState(rawExpression, options = {}) {
  const nextExpression = String(rawExpression || "");

  return {
    rawExpression: nextExpression,
    display: options.display ?? extractDisplayFromExpression(nextExpression),
    expressionLabel: options.expressionLabel ?? formatExpression(nextExpression),
    justEvaluated: Boolean(options.justEvaluated),
  };
}

export default function CalculatorPage({ user }) {
  const [calculator, setCalculator] = useState(createClearedState);

  const handleDigit = (digit) => {
    setCalculator((previous) => {
      const shouldReset = previous.justEvaluated || previous.display === "Error";
      const currentExpression = shouldReset ? "" : previous.rawExpression;

      if (!currentExpression || currentExpression === "0") {
        return createExpressionState(digit);
      }

      if (TRAILING_OPERATOR_PATTERN.test(currentExpression)) {
        return createExpressionState(`${currentExpression}${digit}`);
      }

      const trailingNumber = currentExpression.match(TRAILING_NUMBER_PATTERN)?.[0];
      if (!trailingNumber) {
        return createExpressionState(`${currentExpression}${digit}`);
      }

      let nextTrailingNumber = `${trailingNumber}${digit}`;
      if (trailingNumber === "0") {
        nextTrailingNumber = digit;
      } else if (trailingNumber === "-0") {
        nextTrailingNumber = `-${digit}`;
      }

      return createExpressionState(
        replaceTrailingNumber(currentExpression, nextTrailingNumber)
      );
    });
  };

  const handleDecimal = () => {
    setCalculator((previous) => {
      const shouldReset = previous.justEvaluated || previous.display === "Error";
      const currentExpression = shouldReset ? "" : previous.rawExpression;

      if (!currentExpression) {
        return createExpressionState("0.");
      }

      if (TRAILING_OPERATOR_PATTERN.test(currentExpression)) {
        return createExpressionState(`${currentExpression}0.`);
      }

      const trailingNumber = currentExpression.match(TRAILING_NUMBER_PATTERN)?.[0];
      if (trailingNumber?.includes(".")) {
        return previous;
      }

      if (trailingNumber) {
        return createExpressionState(`${currentExpression}.`);
      }

      return createExpressionState(`${currentExpression}0.`);
    });
  };

  const handleOperator = (operator) => {
    setCalculator((previous) => {
      if (previous.display === "Error") {
        return previous;
      }

      if (previous.justEvaluated) {
        return createExpressionState(`${previous.display}${operator}`);
      }

      const currentExpression = previous.rawExpression;
      if (!currentExpression) {
        if (operator === "-") {
          return createExpressionState("-", {
            display: "-0",
            expressionLabel: "\u2212",
          });
        }
        return previous;
      }

      if (currentExpression === "-") {
        return previous;
      }

      if (TRAILING_OPERATOR_PATTERN.test(currentExpression)) {
        return createExpressionState(
          `${currentExpression.slice(0, -1)}${operator}`
        );
      }

      return createExpressionState(`${currentExpression}${operator}`);
    });
  };

  const handleSignToggle = () => {
    setCalculator((previous) => {
      if (previous.display === "Error") {
        return createClearedState();
      }

      const currentExpression = previous.justEvaluated
        ? previous.display
        : previous.rawExpression;

      if (!currentExpression || currentExpression === "-") {
        return createExpressionState("-0", {
          display: "-0",
          expressionLabel: "\u22120",
        });
      }

      if (TRAILING_OPERATOR_PATTERN.test(currentExpression)) {
        return createExpressionState(`${currentExpression}-0`, {
          display: "-0",
        });
      }

      const trailingNumber = currentExpression.match(TRAILING_NUMBER_PATTERN)?.[0];
      if (!trailingNumber) {
        return previous;
      }

      const toggledNumber = trailingNumber.startsWith("-")
        ? trailingNumber.slice(1) || "0"
        : `-${trailingNumber}`;

      return createExpressionState(
        replaceTrailingNumber(currentExpression, toggledNumber)
      );
    });
  };

  const handlePercent = () => {
    setCalculator((previous) => {
      if (previous.display === "Error") {
        return createClearedState();
      }

      const currentExpression = previous.justEvaluated
        ? previous.display
        : previous.rawExpression;

      if (
        !currentExpression
        || currentExpression === "-"
        || TRAILING_OPERATOR_PATTERN.test(currentExpression)
      ) {
        return previous;
      }

      const trailingNumber = currentExpression.match(TRAILING_NUMBER_PATTERN)?.[0];
      if (!trailingNumber) {
        return previous;
      }

      const numericValue = Number(trailingNumber);
      if (!Number.isFinite(numericValue)) {
        return previous;
      }

      const nextNumber = formatCalculatorNumber(numericValue / 100);
      return createExpressionState(
        replaceTrailingNumber(currentExpression, nextNumber)
      );
    });
  };

  const handleDelete = () => {
    setCalculator((previous) => {
      if (previous.display === "Error" || !previous.rawExpression) {
        return createClearedState();
      }

      const nextExpression = previous.rawExpression.slice(0, -1);
      if (!nextExpression) {
        return createClearedState();
      }

      if (nextExpression === "-") {
        return createExpressionState("-", {
          display: "-0",
          expressionLabel: "\u2212",
        });
      }

      return createExpressionState(nextExpression);
    });
  };

  const handleEquals = () => {
    setCalculator((previous) => {
      const expressionToEvaluate = previous.rawExpression;

      if (
        !expressionToEvaluate
        || expressionToEvaluate === "-"
        || TRAILING_OPERATOR_PATTERN.test(expressionToEvaluate)
      ) {
        return previous;
      }

      try {
        const result = evaluateCalculatorExpression(expressionToEvaluate);
        const resultText = formatCalculatorNumber(result);

        return createExpressionState(resultText, {
          display: resultText,
          expressionLabel: formatExpression(expressionToEvaluate),
          justEvaluated: true,
        });
      } catch {
        return {
          rawExpression: "",
          display: "Error",
          expressionLabel: formatExpression(expressionToEvaluate),
          justEvaluated: true,
        };
      }
    });
  };

  const handleButtonPress = (button) => {
    switch (button.action) {
      case "clear":
        setCalculator(createClearedState());
        return;
      case "digit":
        handleDigit(button.value);
        return;
      case "decimal":
        handleDecimal();
        return;
      case "operator":
        handleOperator(button.value);
        return;
      case "sign":
        handleSignToggle();
        return;
      case "percent":
        handlePercent();
        return;
      case "equals":
        handleEquals();
        return;
      default:
        return;
    }
  };

  const handleKeyboardInput = useEffectEvent((event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const target = event.target;
    if (
      target instanceof HTMLElement
      && (
        target.isContentEditable
        || target.tagName === "INPUT"
        || target.tagName === "TEXTAREA"
        || target.tagName === "SELECT"
      )
    ) {
      return;
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      handleDigit(event.key);
      return;
    }

    switch (event.key) {
      case ".":
        event.preventDefault();
        handleDecimal();
        break;
      case "+":
        event.preventDefault();
        handleOperator("+");
        break;
      case "-":
        event.preventDefault();
        handleOperator("-");
        break;
      case "*":
      case "x":
      case "X":
        event.preventDefault();
        handleOperator("*");
        break;
      case "/":
        event.preventDefault();
        handleOperator("/");
        break;
      case "%":
        event.preventDefault();
        handlePercent();
        break;
      case "Backspace":
        event.preventDefault();
        handleDelete();
        break;
      case "Delete":
      case "Escape":
        event.preventDefault();
        setCalculator(createClearedState());
        break;
      case "Enter":
      case "=":
        event.preventDefault();
        handleEquals();
        break;
      default:
        break;
    }
  });

  useEffect(() => {
    const handleKeyDown = (event) => {
      handleKeyboardInput(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyboardInput]);

  const expressionLabel = calculator.expressionLabel || "\u00a0";
  const displayToneClass =
    calculator.display === "Error"
      ? "tg-calculator-screen-value--error"
      : calculator.justEvaluated
        ? "tg-calculator-screen-value--resolved"
        : "";

  return (
    <QuickAccessLayout
      user={user}
      title="Calculator"
      subtitle="A premium everyday calculator inside Tengacion with refined styling, responsive spacing, and clean keyboard-friendly interactions."
    >
      <section className="card quick-section-card tg-calculator-page">
        <div className="tg-calculator-page__layout">
          <div className="tg-calculator-page__intro">
            <p className="tg-calculator-page__eyebrow">Quick Access</p>
            <h2 className="tg-calculator-page__title">Premium Calculator</h2>
            <p className="tg-calculator-page__copy">
              Clean four-column layout, premium depth, and tasteful colour accents
              designed to feel polished on desktop and comfortable on mobile.
            </p>
          </div>

          <div className="tg-calculator-frame">
            <div className="tg-calculator-shell">
              <div className="tg-calculator-shell__glow" aria-hidden="true" />

              <div className="tg-calculator-topbar">
                <div>
                  <div className="tg-calculator-brand">Tengacion</div>
                  <div className="tg-calculator-subbrand">Calculator</div>
                </div>
                <div className="tg-calculator-status" aria-hidden="true" />
              </div>

              <div className="tg-calculator-screen">
                <div
                  className="tg-calculator-screen-expression"
                  title={calculator.expressionLabel || "Calculator ready"}
                >
                  {expressionLabel}
                </div>
                <div
                  className={`tg-calculator-screen-value ${displayToneClass}`.trim()}
                  aria-live="polite"
                  title={calculator.display}
                >
                  {calculator.display}
                </div>
              </div>

              <div
                className="tg-calculator-keys"
                role="group"
                aria-label="Calculator keypad"
              >
                {BUTTON_ROWS.flat().map((button) => (
                  <button
                    key={`${button.label}-${button.action}`}
                    type="button"
                    className={[
                      "tg-calculator-key",
                      `tg-calculator-key--${button.tone}`,
                      button.className || "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleButtonPress(button)}
                    aria-label={button.label}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="tg-calculator-caption">
              Premium, colourful, and fully responsive for quick calculations in Tengacion.
            </p>
          </div>
        </div>
      </section>
    </QuickAccessLayout>
  );
}
