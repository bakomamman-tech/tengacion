import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import QuickAccessLayout from "../../components/QuickAccessLayout";
import {
  evaluateCalculatorExpression,
  formatCalculatorNumber,
} from "./calculatorUtils";

const THEME_STORAGE_KEY = "tengacion-calculator-theme";
const HISTORY_STORAGE_KEY = "tengacion-calculator-history";

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
    { label: "0", action: "digit", value: "0", className: "col-span-2" },
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

function HistoryIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.71" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function SunIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
    </svg>
  );
}

function MoonIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function DeleteIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 4H8l-5 8 5 8h13" />
      <path d="m16 9-6 6" />
      <path d="m10 9 6 6" />
    </svg>
  );
}

function EqualIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9h12" />
      <path d="M6 15h12" />
    </svg>
  );
}

export default function CalculatorPage({ user }) {
  const [theme, setTheme] = useState("dark");
  const [expression, setExpression] = useState("");
  const [answer, setAnswer] = useState(0);
  const [answerText, setAnswerText] = useState("0");
  const [angleMode, setAngleMode] = useState("DEG");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);

      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
      }

      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) {
          setHistory(parsedHistory);
        }
      }
    } catch {
      // Ignore storage issues so the calculator still opens reliably.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage issues so interaction still works.
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage issues so interaction still works.
    }
  }, [history]);

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
    ].slice(0, 12));
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

  const isDark = theme === "dark";
  const expressionLabel = expression || "0";
  const previewText = preview.valid ? `= ${preview.text}` : preview.text;

  return (
    <QuickAccessLayout
      user={user}
      title="Calculator"
      subtitle="A modern scientific calculator built into Tengacion so users can stay in the app whenever they need quick math."
    >
      <section
        className={`card quick-section-card overflow-hidden border p-4 shadow-2xl md:p-6 ${
          isDark
            ? "border-white/10 bg-[radial-gradient(circle_at_top,_#2b1550_0%,_#130d25_38%,_#09070f_100%)] text-white"
            : "border-slate-200/70 bg-[radial-gradient(circle_at_top,_#f1e8ff_0%,_#f8f6ff_45%,_#eef4ff_100%)] text-slate-900"
        }`}
      >
        <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <div
            className={`overflow-hidden rounded-[32px] border p-4 shadow-2xl md:p-6 ${
              isDark
                ? "border-white/10 bg-white/5 backdrop-blur-2xl"
                : "border-slate-200/70 bg-white/75 backdrop-blur-2xl"
            }`}
          >
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p
                  className={`text-xs uppercase tracking-[0.35em] ${
                    isDark ? "text-white/[0.45]" : "text-slate-500"
                  }`}
                >
                  Tengacion Tools
                </p>
                <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
                  Beautiful Calculator
                </h2>
                <p
                  className={`mt-2 max-w-2xl text-sm leading-6 ${
                    isDark ? "text-white/60" : "text-slate-600"
                  }`}
                >
                  Scientific mode, keyboard input, angle switching, and reusable history wrapped
                  in the exact visual direction of the calculator design you pasted.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowHistory((previous) => !previous)}
                  className={`inline-flex h-11 min-w-[48px] items-center justify-center gap-2 rounded-2xl border px-3 transition ${
                    isDark
                      ? "border-white/10 bg-white/10 text-white hover:bg-white/[0.15]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  aria-label={showHistory ? "Hide history" : "Show history"}
                  title={showHistory ? "Hide history" : "Show history"}
                >
                  <HistoryIcon className="h-[18px] w-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme((previous) => (previous === "dark" ? "light" : "dark"))}
                  className={`inline-flex h-11 min-w-[48px] items-center justify-center rounded-2xl border transition ${
                    isDark
                      ? "border-white/10 bg-white/10 text-white hover:bg-white/[0.15]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  aria-label={`Switch to ${isDark ? "light" : "dark"} calculator theme`}
                  title={`Switch to ${isDark ? "light" : "dark"} calculator theme`}
                >
                  {isDark ? (
                    <SunIcon className="h-[18px] w-[18px]" />
                  ) : (
                    <MoonIcon className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
            </div>

            <div
              className={`rounded-[28px] border p-4 md:p-6 ${
                isDark
                  ? "border-white/10 bg-gradient-to-br from-white/10 to-white/5"
                  : "border-slate-200 bg-gradient-to-br from-white to-slate-50"
              }`}
            >
              <div
                className={`mb-6 rounded-[24px] p-3 md:min-h-[220px] md:p-4 ${
                  isDark
                    ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]"
                    : "bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.88))]"
                }`}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`text-xs uppercase tracking-[0.26em] ${
                      isDark ? "text-white/[0.45]" : "text-slate-500"
                    }`}
                  >
                    Current expression
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex min-h-[34px] items-center rounded-full border px-3 text-xs font-semibold ${
                        isDark
                          ? "border-white/10 bg-white/10 text-white/80"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {angleMode}
                    </span>
                    <div
                      className={`inline-flex rounded-full border p-1 ${
                        isDark
                          ? "border-white/10 bg-white/10"
                          : "border-slate-200 bg-white"
                      }`}
                      role="group"
                      aria-label="Angle mode"
                    >
                      <button
                        type="button"
                        onClick={() => setAngleMode("DEG")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          angleMode === "DEG"
                            ? "bg-fuchsia-600 text-white"
                            : isDark
                              ? "text-white/75 hover:bg-white/10"
                              : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        DEG
                      </button>
                      <button
                        type="button"
                        onClick={() => setAngleMode("RAD")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          angleMode === "RAD"
                            ? "bg-fuchsia-600 text-white"
                            : isDark
                              ? "text-white/75 hover:bg-white/10"
                              : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        RAD
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className="max-w-full break-all text-right text-4xl font-semibold leading-tight md:text-6xl"
                  title={expressionLabel}
                >
                  {expressionLabel}
                </div>
                <div
                  className={`mt-4 max-w-full break-all text-right text-2xl font-semibold leading-tight md:text-3xl ${
                    preview.tone === "error"
                      ? "text-rose-400"
                      : preview.tone === "success"
                        ? isDark
                          ? "text-emerald-300"
                          : "text-emerald-600"
                        : isDark
                          ? "text-white/60"
                          : "text-slate-500"
                  }`}
                  title={preview.text}
                >
                  {previewText}
                </div>
                <p
                  className={`mt-4 text-right text-sm leading-6 ${
                    isDark ? "text-white/[0.55]" : "text-slate-500"
                  }`}
                >
                  {preview.helper}
                </p>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <article
                  className={`rounded-[24px] border p-4 ${
                    isDark ? "border-white/10 bg-white/[0.06]" : "border-slate-200 bg-white"
                  }`}
                >
                  <span
                    className={`text-xs uppercase tracking-[0.24em] ${
                      isDark ? "text-white/[0.45]" : "text-slate-500"
                    }`}
                  >
                    Last answer
                  </span>
                  <strong className="mt-2 block break-all text-lg font-semibold">
                    {answerText}
                  </strong>
                </article>

                <article
                  className={`rounded-[24px] border p-4 ${
                    isDark ? "border-white/10 bg-white/[0.06]" : "border-slate-200 bg-white"
                  }`}
                >
                  <span
                    className={`text-xs uppercase tracking-[0.24em] ${
                      isDark ? "text-white/[0.45]" : "text-slate-500"
                    }`}
                  >
                    History
                  </span>
                  <strong className="mt-2 block text-lg font-semibold">{history.length}</strong>
                </article>

                <article
                  className={`rounded-[24px] border p-4 ${
                    isDark ? "border-white/10 bg-white/[0.06]" : "border-slate-200 bg-white"
                  }`}
                >
                  <span
                    className={`text-xs uppercase tracking-[0.24em] ${
                      isDark ? "text-white/[0.45]" : "text-slate-500"
                    }`}
                  >
                    Keyboard
                  </span>
                  <strong className="mt-2 block text-lg font-semibold">Ready</strong>
                </article>
              </div>

              <div
                className="grid grid-cols-5 gap-3 md:gap-4"
                role="group"
                aria-label="Calculator keypad"
              >
                {KEYPAD_ROWS.flat().map((button) => {
                  const isOperator = button.variant === "operator";
                  const isTop = button.variant === "utility";
                  const isEqual = button.variant === "primary";
                  const isScientific = button.variant === "scientific";
                  const isDelete = button.action === "delete";

                  return (
                    <button
                      key={`${button.label}-${button.action}`}
                      type="button"
                      onClick={() => handleCalculatorAction(button)}
                      className={[
                        button.className || "",
                        "h-16 rounded-[22px] text-lg font-semibold shadow-lg transition duration-150 hover:-translate-y-0.5 md:h-20 md:text-xl",
                        isEqual
                          ? "bg-gradient-to-br from-emerald-400 to-green-600 text-white"
                          : isOperator
                            ? "bg-gradient-to-br from-fuchsia-500 to-violet-700 text-white"
                            : isTop
                              ? isDark
                                ? "bg-white/12 text-white"
                                : "bg-slate-200 text-slate-800"
                              : isScientific
                                ? isDark
                                  ? "bg-violet-500/20 text-white"
                                  : "bg-violet-100 text-violet-900"
                                : isDark
                                  ? "bg-white/8 text-white"
                                  : "bg-white text-slate-900",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {isDelete ? (
                        <DeleteIcon className="mx-auto h-5 w-5" />
                      ) : isEqual ? (
                        <EqualIcon className="mx-auto h-5 w-5" />
                      ) : (
                        button.label
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside
            className={`rounded-[32px] border p-4 shadow-2xl md:p-6 ${
              isDark
                ? "border-white/10 bg-white/5 backdrop-blur-2xl"
                : "border-slate-200/70 bg-white/75 backdrop-blur-2xl"
            } ${showHistory ? "block" : "hidden xl:block"}`}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p
                  className={`text-xs uppercase tracking-[0.3em] ${
                    isDark ? "text-white/[0.45]" : "text-slate-500"
                  }`}
                >
                  Recent Activity
                </p>
                <h3 className="mt-2 text-xl font-semibold md:text-2xl">History</h3>
              </div>
              <button
                type="button"
                onClick={clearHistory}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                  isDark
                    ? "bg-white/10 text-white hover:bg-white/[0.15]"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Clear
              </button>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div
                className={`rounded-[24px] border p-4 ${
                  isDark ? "border-white/10 bg-white/[0.06]" : "border-slate-200 bg-white"
                }`}
              >
                <div
                  className={`text-xs uppercase tracking-[0.24em] ${
                    isDark ? "text-white/[0.45]" : "text-slate-500"
                  }`}
                >
                  Mode
                </div>
                <div className="mt-2 text-lg font-semibold">{angleMode}</div>
              </div>
              <div
                className={`rounded-[24px] border p-4 ${
                  isDark ? "border-white/10 bg-white/[0.06]" : "border-slate-200 bg-white"
                }`}
              >
                <div
                  className={`text-xs uppercase tracking-[0.24em] ${
                    isDark ? "text-white/[0.45]" : "text-slate-500"
                  }`}
                >
                  Scientific
                </div>
                <div className="mt-2 text-lg font-semibold">sin log √</div>
              </div>
              <div
                className={`rounded-[24px] border p-4 ${
                  isDark ? "border-white/10 bg-white/[0.06]" : "border-slate-200 bg-white"
                }`}
              >
                <div
                  className={`text-xs uppercase tracking-[0.24em] ${
                    isDark ? "text-white/[0.45]" : "text-slate-500"
                  }`}
                >
                  Shortcut
                </div>
                <div className="mt-2 text-lg font-semibold">Enter =</div>
              </div>
            </div>

            <div className="space-y-3">
              {history.length === 0 ? (
                <div
                  className={`rounded-[24px] border border-dashed p-5 text-sm ${
                    isDark
                      ? "border-white/10 text-white/[0.55]"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  No calculations yet. Your recent expressions will appear here.
                </div>
              ) : (
                <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
                  {history.map((entry) => (
                    <button
                      key={`${entry.createdAt}-${entry.expression}`}
                      type="button"
                      onClick={() => reuseHistoryResult(entry)}
                      className={`block w-full rounded-[24px] border p-4 text-left transition ${
                        isDark
                          ? "border-white/10 bg-white/5 hover:bg-white/10"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`mb-1 break-all text-sm ${
                          isDark ? "text-white/[0.45]" : "text-slate-500"
                        }`}
                      >
                        {entry.expression}
                      </div>
                      <div className="break-all text-xl font-semibold">= {entry.resultText}</div>
                      <div
                        className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] ${
                          isDark ? "text-white/40" : "text-slate-500"
                        }`}
                      >
                        {entry.angleMode}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              className={`mt-5 rounded-[24px] p-4 text-sm leading-6 ${
                isDark ? "bg-white/5 text-white/60" : "bg-slate-50 text-slate-600"
              }`}
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em]">
                Built for flow
              </p>
              <ul className="space-y-2">
                {CALCULATOR_HINTS.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </QuickAccessLayout>
  );
}
