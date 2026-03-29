import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import QuickAccessLayout from "../../components/QuickAccessLayout";
import {
  evaluateCalculatorExpression,
  formatCalculatorNumber,
} from "./calculatorUtils";
import "./CalculatorPage.css";

const KEYPAD_ROWS = [
  [
    { label: "AC", action: "clear", variant: "utility" },
    { label: "DEL", action: "delete", variant: "utility" },
    { label: "(", action: "openParen", variant: "utility" },
    { label: ")", action: "closeParen", variant: "utility" },
    { label: "÷", action: "operator", value: "÷", variant: "operator" },
  ],
  [
    { label: "sin", action: "function", value: "sin(", variant: "scientific" },
    { label: "cos", action: "function", value: "cos(", variant: "scientific" },
    { label: "tan", action: "function", value: "tan(", variant: "scientific" },
    { label: "π", action: "constant", value: "π", variant: "scientific" },
    { label: "×", action: "operator", value: "×", variant: "operator" },
  ],
  [
    { label: "log", action: "function", value: "log(", variant: "scientific" },
    { label: "ln", action: "function", value: "ln(", variant: "scientific" },
    { label: "√", action: "function", value: "√(", variant: "scientific" },
    { label: "x²", action: "square", variant: "scientific" },
    { label: "-", action: "operator", value: "-", variant: "operator" },
  ],
  [
    { label: "7", action: "digit", value: "7" },
    { label: "8", action: "digit", value: "8" },
    { label: "9", action: "digit", value: "9" },
    { label: "^", action: "operator", value: "^", variant: "operator" },
    { label: "+", action: "operator", value: "+", variant: "operator" },
  ],
  [
    { label: "4", action: "digit", value: "4" },
    { label: "5", action: "digit", value: "5" },
    { label: "6", action: "digit", value: "6" },
    { label: "%", action: "postfix", value: "%", variant: "scientific" },
    { label: "x!", action: "postfix", value: "!", variant: "scientific" },
  ],
  [
    { label: "1", action: "digit", value: "1" },
    { label: "2", action: "digit", value: "2" },
    { label: "3", action: "digit", value: "3" },
    { label: "Ans", action: "constant", value: "Ans", variant: "scientific" },
    { label: "±", action: "sign", variant: "scientific" },
  ],
  [
    { label: "0", action: "digit", value: "0", className: "calculator-key--span-2" },
    { label: ".", action: "decimal" },
    { label: "e", action: "constant", value: "e", variant: "scientific" },
    { label: "=", action: "equals", variant: "primary" },
  ],
];

const CALCULATOR_HINTS = [
  "Use Ans to continue from the previous result without retyping it.",
  "Trig keys follow the current DEG or RAD mode instantly.",
  "Keyboard input works too: numbers, operators, parentheses, Enter, and Backspace.",
];

function countToken(value, token) {
  return String(value || "").split(token).length - 1;
}

function endsWithNumber(value) {
  return /\d$/.test(String(value || "").trim());
}

function endsWithSpecialValue(value) {
  const current = String(value || "").trim();
  return (
    current.endsWith(")") ||
    current.endsWith("π") ||
    current.endsWith("e") ||
    current.endsWith("Ans") ||
    current.endsWith("!") ||
    current.endsWith("%")
  );
}

function endsWithValue(value) {
  return endsWithNumber(value) || endsWithSpecialValue(value);
}

function endsWithOperator(value) {
  return /[+\-×÷^]$/.test(String(value || "").trim());
}

function getPreparedExpression(value) {
  const current = String(value || "").trim();
  if (!current || current === "-" || endsWithOperator(current) || current.endsWith("(")) {
    return "";
  }

  const unmatchedParens = countToken(current, "(") - countToken(current, ")");
  if (unmatchedParens > 0) {
    return `${current}${")".repeat(unmatchedParens)}`;
  }

  return current;
}

function deleteLastToken(value) {
  const current = String(value || "");
  if (!current) {
    return "";
  }

  const compoundTokens = ["Ans", "sin(", "cos(", "tan(", "log(", "ln(", "√("];
  const matchedToken = compoundTokens.find((token) => current.endsWith(token));
  if (matchedToken) {
    return current.slice(0, -matchedToken.length);
  }

  return current.slice(0, -1);
}

function getKeyToneClass(button) {
  switch (button.action) {
    case "clear":
      return "calculator-key--tone-danger";
    case "delete":
      return "calculator-key--tone-secondary";
    case "sign":
      return "calculator-key--tone-sky";
    case "digit":
    case "decimal":
      return "calculator-key--tone-number";
    case "openParen":
    case "closeParen":
      return "calculator-key--tone-bracket";
    case "operator":
      switch (button.value) {
        case "÷":
          return "calculator-key--tone-orange";
        case "×":
          return "calculator-key--tone-teal";
        case "-":
          return "calculator-key--tone-violet";
        case "+":
          return "calculator-key--tone-coral";
        case "^":
          return "calculator-key--tone-indigo";
        default:
          return "calculator-key--tone-operator";
      }
    case "function":
      switch (button.value) {
        case "sin(":
          return "calculator-key--tone-blue";
        case "cos(":
          return "calculator-key--tone-indigo";
        case "tan(":
          return "calculator-key--tone-violet";
        case "log(":
          return "calculator-key--tone-cyan";
        case "ln(":
          return "calculator-key--tone-mint";
        case "√(":
          return "calculator-key--tone-teal";
        default:
          return "calculator-key--tone-science";
      }
    case "constant":
      switch (button.value) {
        case "π":
          return "calculator-key--tone-azure";
        case "Ans":
          return "calculator-key--tone-green";
        case "e":
          return "calculator-key--tone-lime";
        default:
          return "calculator-key--tone-science";
      }
    case "postfix":
      if (button.value === "%") {
        return "calculator-key--tone-amber";
      }
      if (button.value === "!") {
        return "calculator-key--tone-plum";
      }
      return "calculator-key--tone-science";
    case "square":
      return "calculator-key--tone-plum";
    case "equals":
      return "calculator-key--tone-equals";
    default:
      return "calculator-key--tone-science";
  }
}

export default function CalculatorPage({ user }) {
  const [expression, setExpression] = useState("");
  const [answer, setAnswer] = useState(0);
  const [answerText, setAnswerText] = useState("0");
  const [angleMode, setAngleMode] = useState("DEG");
  const [history, setHistory] = useState([]);

  const preparedExpression = useMemo(() => getPreparedExpression(expression), [expression]);

  const preview = useMemo(() => {
    if (!expression.trim()) {
      return {
        valid: false,
        text: answerText,
        helper: "Your next result will appear here as you build the expression.",
        tone: "idle",
      };
    }

    if (!preparedExpression) {
      return {
        valid: false,
        text: "Expression in progress",
        helper: "Complete the current formula to preview the result.",
        tone: "idle",
      };
    }

    try {
      const result = evaluateCalculatorExpression(preparedExpression, {
        answer,
        angleMode,
      });
      return {
        valid: true,
        result,
        text: formatCalculatorNumber(result),
        helper:
          preparedExpression !== expression.trim()
            ? "Missing closing bracket added automatically for the preview."
            : angleMode === "DEG"
              ? "Angle mode is set to degrees."
              : "Angle mode is set to radians.",
        tone: "success",
      };
    } catch (err) {
      return {
        valid: false,
        text: err?.message || "Calculation unavailable",
        helper: "Adjust the expression and try again.",
        tone: "error",
      };
    }
  }, [answer, answerText, angleMode, expression, preparedExpression]);

  const appendDigit = useCallback((digit) => {
    setExpression((previous) => {
      const current = String(previous || "");
      if (!current) {
        return digit;
      }
      if (current === "0") {
        return digit;
      }
      if (endsWithSpecialValue(current)) {
        return `${current}×${digit}`;
      }
      return `${current}${digit}`;
    });
  }, []);

  const appendDecimal = useCallback(() => {
    setExpression((previous) => {
      const current = String(previous || "");
      if (!current) {
        return "0.";
      }
      if (current === "-") {
        return "-0.";
      }
      if (endsWithSpecialValue(current)) {
        return `${current}×0.`;
      }
      if (endsWithOperator(current) || current.endsWith("(")) {
        return `${current}0.`;
      }

      const currentChunk = current.match(/(\d+\.?\d*|\.\d+)$/)?.[0] || "";
      if (currentChunk.includes(".")) {
        return current;
      }
      return `${current}.`;
    });
  }, []);

  const appendConstant = useCallback((token) => {
    setExpression((previous) => {
      const current = String(previous || "");
      if (!current || current === "0") {
        return token;
      }
      return `${current}${endsWithValue(current) ? "×" : ""}${token}`;
    });
  }, []);

  const appendFunction = useCallback((token) => {
    setExpression((previous) => {
      const current = String(previous || "");
      if (!current) {
        return token;
      }
      if (current === "-") {
        return `-${token}`;
      }
      return `${current}${endsWithValue(current) ? "×" : ""}${token}`;
    });
  }, []);

  const appendOpenParen = useCallback(() => {
    setExpression((previous) => {
      const current = String(previous || "");
      if (!current) {
        return "(";
      }
      if (current === "-") {
        return "-(";
      }
      return `${current}${endsWithValue(current) ? "×" : ""}(`;
    });
  }, []);

  const appendCloseParen = useCallback(() => {
    setExpression((previous) => {
      const current = String(previous || "");
      if (
        !current ||
        current === "-" ||
        current.endsWith("(") ||
        endsWithOperator(current)
      ) {
        return current;
      }

      const openCount = countToken(current, "(");
      const closeCount = countToken(current, ")");
      if (openCount <= closeCount) {
        return current;
      }

      return `${current})`;
    });
  }, []);

  const appendOperator = useCallback((operator) => {
    setExpression((previous) => {
      const current = String(previous || "").trim();
      if (!current) {
        return operator === "-" ? "-" : "";
      }
      if (current === "-" && operator !== "-") {
        return current;
      }
      if (endsWithOperator(current)) {
        return `${current.slice(0, -1)}${operator}`;
      }
      if (current.endsWith("(")) {
        return operator === "-" ? `${current}-` : current;
      }
      return `${current}${operator}`;
    });
  }, []);

  const appendPostfix = useCallback((token) => {
    setExpression((previous) => {
      const current = String(previous || "");
      if (!endsWithValue(current)) {
        return current;
      }
      return `${current}${token}`;
    });
  }, []);

  const applySquare = useCallback(() => {
    setExpression((previous) => {
      const current = String(previous || "").trim();
      if (!current) {
        return "(Ans)^2";
      }
      if (!endsWithValue(current)) {
        return current;
      }
      return `(${current})^2`;
    });
  }, []);

  const toggleSign = useCallback(() => {
    setExpression((previous) => {
      const current = String(previous || "").trim();
      if (!current) {
        return "-";
      }
      if (current === "-") {
        return "";
      }
      if (current.startsWith("-(") && current.endsWith(")")) {
        return current.slice(2, -1);
      }
      return `-(${current})`;
    });
  }, []);

  const deleteExpression = useCallback(() => {
    setExpression((previous) => deleteLastToken(previous));
  }, []);

  const clearExpression = useCallback(() => {
    setExpression("");
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const commitResult = useCallback(() => {
    if (!preparedExpression) {
      toast.error("Finish the current expression before calculating.");
      return;
    }

    if (!preview.valid) {
      toast.error(preview.text || "This expression cannot be calculated yet.");
      return;
    }

    const nextResult = preview.result;
    const nextResultText = preview.text;
    const nextHistoryEntry = {
      expression: preparedExpression,
      result: nextResult,
      resultText: nextResultText,
      angleMode,
      createdAt: Date.now(),
    };

    setAnswer(nextResult);
    setAnswerText(nextResultText);
    setExpression(nextResultText);
    setHistory((previous) => [
      nextHistoryEntry,
      ...previous.filter(
        (entry) =>
          !(
            entry.expression === nextHistoryEntry.expression &&
            entry.resultText === nextHistoryEntry.resultText &&
            entry.angleMode === nextHistoryEntry.angleMode
          )
      ),
    ].slice(0, 8));
  }, [angleMode, preparedExpression, preview]);

  const reuseHistoryResult = useCallback((entry) => {
    setExpression(entry.resultText);
    setAnswer(entry.result);
    setAnswerText(entry.resultText);
  }, []);

  const handleCalculatorAction = useCallback(
    (button) => {
      switch (button.action) {
        case "clear":
          clearExpression();
          return;
        case "delete":
          deleteExpression();
          return;
        case "digit":
          appendDigit(button.value);
          return;
        case "decimal":
          appendDecimal();
          return;
        case "operator":
          appendOperator(button.value);
          return;
        case "function":
          appendFunction(button.value);
          return;
        case "constant":
          appendConstant(button.value);
          return;
        case "openParen":
          appendOpenParen();
          return;
        case "closeParen":
          appendCloseParen();
          return;
        case "postfix":
          appendPostfix(button.value);
          return;
        case "square":
          applySquare();
          return;
        case "sign":
          toggleSign();
          return;
        case "equals":
          commitResult();
          return;
        default:
          break;
      }
    },
    [
      appendCloseParen,
      appendConstant,
      appendDecimal,
      appendDigit,
      appendFunction,
      appendOpenParen,
      appendOperator,
      appendPostfix,
      applySquare,
      clearExpression,
      commitResult,
      deleteExpression,
      toggleSign,
    ]
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        appendDigit(event.key);
        return;
      }

      switch (event.key) {
        case ".":
          event.preventDefault();
          appendDecimal();
          break;
        case "+":
          event.preventDefault();
          appendOperator("+");
          break;
        case "-":
          event.preventDefault();
          appendOperator("-");
          break;
        case "*":
          event.preventDefault();
          appendOperator("×");
          break;
        case "/":
          event.preventDefault();
          appendOperator("÷");
          break;
        case "^":
          event.preventDefault();
          appendOperator("^");
          break;
        case "%":
          event.preventDefault();
          appendPostfix("%");
          break;
        case "(":
          event.preventDefault();
          appendOpenParen();
          break;
        case ")":
          event.preventDefault();
          appendCloseParen();
          break;
        case "Backspace":
          event.preventDefault();
          deleteExpression();
          break;
        case "Delete":
        case "Escape":
          event.preventDefault();
          clearExpression();
          break;
        case "Enter":
        case "=":
          event.preventDefault();
          commitResult();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    appendCloseParen,
    appendDecimal,
    appendDigit,
    appendOpenParen,
    appendOperator,
    appendPostfix,
    clearExpression,
    commitResult,
    deleteExpression,
  ]);

  return (
    <QuickAccessLayout
      user={user}
      title="Calculator"
      subtitle="A modern scientific calculator built into Tengacion so users can stay in the app whenever they need quick math."
    >
      <section className="card quick-section-card calculator-neo">
        <div className="quick-section-head calculator-section-head">
          <div>
            <h2>Scientific workspace</h2>
            <p className="calculator-section-copy">
              Calculate instantly, switch angle modes, and keep recent answers close by.
            </p>
          </div>
          <div className="calculator-toolbar">
            <div className="calculator-angle-switch" role="group" aria-label="Angle mode">
              <button
                type="button"
                className={angleMode === "DEG" ? "active" : ""}
                onClick={() => setAngleMode("DEG")}
              >
                DEG
              </button>
              <button
                type="button"
                className={angleMode === "RAD" ? "active" : ""}
                onClick={() => setAngleMode("RAD")}
              >
                RAD
              </button>
            </div>
            <button type="button" className="calculator-inline-btn" onClick={clearHistory}>
              Clear history
            </button>
          </div>
        </div>

        <div className="calculator-workspace">
          <div className="calculator-panel">
            <section className="calculator-display" aria-live="polite">
              <div className="calculator-display__top">
                <span className="calculator-display__eyebrow">Current expression</span>
                <span className="calculator-display__mode">{angleMode}</span>
              </div>
              <div className="calculator-expression" title={expression || "0"}>
                {expression || "0"}
              </div>
              <div
                className={`calculator-result calculator-result--${preview.tone}`}
                title={preview.text}
              >
                {preview.valid ? `= ${preview.text}` : preview.text}
              </div>
              <p className="calculator-helper">{preview.helper}</p>
            </section>

            <div className="calculator-chip-row">
              <article className="calculator-chip">
                <span>Last answer</span>
                <strong>{answerText}</strong>
              </article>
              <article className="calculator-chip">
                <span>History</span>
                <strong>{history.length}</strong>
              </article>
              <article className="calculator-chip">
                <span>Keyboard</span>
                <strong>Ready</strong>
              </article>
            </div>

            <div className="calculator-keypad" role="group" aria-label="Calculator keypad">
              {KEYPAD_ROWS.flat().map((button) => (
                <button
                  key={`${button.label}-${button.action}`}
                  type="button"
                  className={[
                    "calculator-key",
                    button.variant ? `calculator-key--${button.variant}` : "",
                    getKeyToneClass(button),
                    button.className || "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleCalculatorAction(button)}
                >
                  {button.label}
                </button>
              ))}
            </div>
          </div>

          <aside className="calculator-side">
            <section className="calculator-side-card">
              <p className="calculator-side-card__eyebrow">Built for flow</p>
              <div className="calculator-stats-grid">
                <article className="calculator-stat-card">
                  <span>Mode</span>
                  <strong>{angleMode}</strong>
                </article>
                <article className="calculator-stat-card">
                  <span>Scientific</span>
                  <strong>sin log √</strong>
                </article>
                <article className="calculator-stat-card">
                  <span>Shortcut</span>
                  <strong>Enter =</strong>
                </article>
              </div>
              <ul className="calculator-hint-list">
                {CALCULATOR_HINTS.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            </section>

            <section className="calculator-side-card">
              <div className="calculator-history-head">
                <div>
                  <h3>Recent calculations</h3>
                  <p>Tap any result to keep going from there.</p>
                </div>
                {history.length > 0 ? (
                  <button
                    type="button"
                    className="calculator-inline-btn"
                    onClick={clearHistory}
                  >
                    Reset
                  </button>
                ) : null}
              </div>

              {history.length > 0 ? (
                <div className="calculator-history-list">
                  {history.map((entry) => (
                    <button
                      key={`${entry.createdAt}-${entry.expression}`}
                      type="button"
                      className="calculator-history-item"
                      onClick={() => reuseHistoryResult(entry)}
                    >
                      <span className="calculator-history-item__expression">
                        {entry.expression}
                      </span>
                      <strong>= {entry.resultText}</strong>
                      <small>{entry.angleMode}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="quick-empty calculator-empty-history">
                  No calculations yet. Your latest results will appear here.
                </p>
              )}
            </section>
          </aside>
        </div>
      </section>
    </QuickAccessLayout>
  );
}
