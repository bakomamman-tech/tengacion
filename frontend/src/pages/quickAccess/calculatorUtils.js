const EPSILON = 1e-12;

const FUNCTION_NAMES = new Set([
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "sqrt",
  "log",
  "ln",
  "abs",
]);

const OPERATOR_CONFIG = {
  "+": {
    precedence: 1,
    associativity: "left",
    args: 2,
    evaluate: (left, right) => left + right,
  },
  "-": {
    precedence: 1,
    associativity: "left",
    args: 2,
    evaluate: (left, right) => left - right,
  },
  "*": {
    precedence: 2,
    associativity: "left",
    args: 2,
    evaluate: (left, right) => left * right,
  },
  "/": {
    precedence: 2,
    associativity: "left",
    args: 2,
    evaluate: (left, right) => {
      if (Math.abs(right) < EPSILON) {
        throw new Error("Cannot divide by zero");
      }
      return left / right;
    },
  },
  "^": {
    precedence: 4,
    associativity: "right",
    args: 2,
    evaluate: (left, right) => Math.pow(left, right),
  },
  neg: {
    precedence: 3,
    associativity: "right",
    args: 1,
    evaluate: (value) => -value,
  },
  "!": {
    precedence: 5,
    associativity: "left",
    args: 1,
    evaluate: (value) => factorial(value),
  },
  "%": {
    precedence: 5,
    associativity: "left",
    args: 1,
    evaluate: (value) => value / 100,
  },
};

function sanitizeNumber(value) {
  if (Math.abs(value) < EPSILON) {
    return 0;
  }
  return value;
}

function ensureFiniteResult(value) {
  if (!Number.isFinite(value)) {
    throw new Error("Result is out of range");
  }
  return sanitizeNumber(value);
}

function factorial(value) {
  if (!Number.isFinite(value)) {
    throw new Error("Factorial requires a finite value");
  }
  if (value < 0) {
    throw new Error("Factorial is only defined for zero or positive integers");
  }
  if (!Number.isInteger(value)) {
    throw new Error("Factorial is only defined for integers");
  }
  if (value > 170) {
    throw new Error("Factorial is too large to calculate safely");
  }

  let result = 1;
  for (let index = 2; index <= value; index += 1) {
    result *= index;
  }
  return result;
}

function toRadians(value, angleMode) {
  return angleMode === "RAD" ? value : (value * Math.PI) / 180;
}

function fromRadians(value, angleMode) {
  return angleMode === "RAD" ? value : (value * 180) / Math.PI;
}

function applyScientificFunction(name, value, angleMode) {
  switch (name) {
    case "sin":
      return ensureFiniteResult(Math.sin(toRadians(value, angleMode)));
    case "cos":
      return ensureFiniteResult(Math.cos(toRadians(value, angleMode)));
    case "tan": {
      const radians = toRadians(value, angleMode);
      if (Math.abs(Math.cos(radians)) < EPSILON) {
        throw new Error("Tangent is undefined for this angle");
      }
      return ensureFiniteResult(Math.tan(radians));
    }
    case "asin":
      if (value < -1 || value > 1) {
        throw new Error("asin is only defined between -1 and 1");
      }
      return ensureFiniteResult(fromRadians(Math.asin(value), angleMode));
    case "acos":
      if (value < -1 || value > 1) {
        throw new Error("acos is only defined between -1 and 1");
      }
      return ensureFiniteResult(fromRadians(Math.acos(value), angleMode));
    case "atan":
      return ensureFiniteResult(fromRadians(Math.atan(value), angleMode));
    case "sqrt":
      if (value < 0) {
        throw new Error("Square root is only defined for zero or positive values");
      }
      return ensureFiniteResult(Math.sqrt(value));
    case "log":
      if (value <= 0) {
        throw new Error("log is only defined for values greater than zero");
      }
      return ensureFiniteResult(Math.log10(value));
    case "ln":
      if (value <= 0) {
        throw new Error("ln is only defined for values greater than zero");
      }
      return ensureFiniteResult(Math.log(value));
    case "abs":
      return Math.abs(value);
    default:
      throw new Error(`Unsupported function "${name}"`);
  }
}

function constantValue(name, answer) {
  switch (name) {
    case "pi":
      return Math.PI;
    case "e":
      return Math.E;
    case "ans":
      return Number.isFinite(answer) ? answer : 0;
    default:
      throw new Error(`Unknown constant "${name}"`);
  }
}

export function normalizeCalculatorExpression(expression = "") {
  return String(expression)
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/Ans/gi, "ans")
    .replace(/−/g, "-");
}

function tokenizeExpression(expression) {
  const tokens = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (/\d|\./.test(char)) {
      let end = index + 1;
      while (end < expression.length && /[\d.]/.test(expression[end])) {
        end += 1;
      }

      if (end < expression.length && /[eE]/.test(expression[end])) {
        let exponentEnd = end + 1;
        if (expression[exponentEnd] === "+" || expression[exponentEnd] === "-") {
          exponentEnd += 1;
        }

        const exponentDigitsStart = exponentEnd;
        while (exponentEnd < expression.length && /\d/.test(expression[exponentEnd])) {
          exponentEnd += 1;
        }

        if (exponentDigitsStart === exponentEnd) {
          throw new Error("Invalid scientific notation");
        }

        end = exponentEnd;
      }

      const fragment = expression.slice(index, end);
      const mantissa = fragment.split(/[eE]/)[0];
      if (mantissa === "." || mantissa.split(".").length > 2) {
        throw new Error("Invalid number");
      }

      const parsedValue = Number(fragment);
      if (!Number.isFinite(parsedValue)) {
        throw new Error("Invalid number");
      }

      tokens.push({ type: "number", value: parsedValue });
      index = end;
      continue;
    }

    if (/[A-Za-z]/.test(char)) {
      let end = index + 1;
      while (end < expression.length && /[A-Za-z]/.test(expression[end])) {
        end += 1;
      }

      const identifier = expression.slice(index, end).toLowerCase();
      if (FUNCTION_NAMES.has(identifier)) {
        tokens.push({ type: "function", value: identifier });
      } else if (identifier === "pi" || identifier === "e" || identifier === "ans") {
        tokens.push({ type: "constant", value: identifier });
      } else {
        throw new Error(`Unknown token "${identifier}"`);
      }
      index = end;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }

    if ("+-*/^!%".includes(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    throw new Error(`Unsupported character "${char}"`);
  }

  return tokens;
}

function endsOperand(token) {
  if (!token) {
    return false;
  }

  if (token.type === "number" || token.type === "constant") {
    return true;
  }

  if (token.type === "paren" && token.value === ")") {
    return true;
  }

  return token.type === "operator" && (token.value === "!" || token.value === "%");
}

function startsOperand(token) {
  if (!token) {
    return false;
  }

  if (
    token.type === "number" ||
    token.type === "constant" ||
    token.type === "function"
  ) {
    return true;
  }

  if (token.type === "paren" && token.value === "(") {
    return true;
  }

  return token.type === "operator" && token.value === "neg";
}

function normalizeTokens(tokens) {
  const normalized = [];

  tokens.forEach((rawToken) => {
    const previousToken = normalized[normalized.length - 1];
    let token = rawToken;

    if (
      token.type === "operator" &&
      token.value === "-" &&
      (!previousToken ||
        previousToken.type === "function" ||
        (previousToken.type === "paren" && previousToken.value === "(") ||
        (previousToken.type === "operator" &&
          previousToken.value !== "!" &&
          previousToken.value !== "%"))
    ) {
      token = { type: "operator", value: "neg" };
    }

    if (endsOperand(previousToken) && startsOperand(token)) {
      normalized.push({ type: "operator", value: "*" });
    }

    normalized.push(token);
  });

  return normalized;
}

function toReversePolishNotation(tokens) {
  const output = [];
  const stack = [];

  tokens.forEach((token) => {
    if (token.type === "number" || token.type === "constant") {
      output.push(token);
      return;
    }

    if (token.type === "function") {
      stack.push(token);
      return;
    }

    if (token.type === "operator") {
      const currentConfig = OPERATOR_CONFIG[token.value];

      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.type !== "operator") {
          break;
        }

        const topConfig = OPERATOR_CONFIG[top.value];
        const shouldPop =
          currentConfig.associativity === "left"
            ? currentConfig.precedence <= topConfig.precedence
            : currentConfig.precedence < topConfig.precedence;

        if (!shouldPop) {
          break;
        }

        output.push(stack.pop());
      }

      stack.push(token);
      return;
    }

    if (token.type === "paren" && token.value === "(") {
      stack.push(token);
      return;
    }

    if (token.type === "paren" && token.value === ")") {
      while (
        stack.length > 0 &&
        !(stack[stack.length - 1].type === "paren" && stack[stack.length - 1].value === "(")
      ) {
        output.push(stack.pop());
      }

      if (stack.length === 0) {
        throw new Error("Mismatched parentheses");
      }

      stack.pop();

      if (stack.length > 0 && stack[stack.length - 1].type === "function") {
        output.push(stack.pop());
      }
    }
  });

  while (stack.length > 0) {
    const token = stack.pop();
    if (token.type === "paren") {
      throw new Error("Mismatched parentheses");
    }
    output.push(token);
  }

  return output;
}

function evaluateReversePolishNotation(tokens, { answer = 0, angleMode = "DEG" } = {}) {
  const stack = [];

  tokens.forEach((token) => {
    if (token.type === "number") {
      stack.push(token.value);
      return;
    }

    if (token.type === "constant") {
      stack.push(constantValue(token.value, answer));
      return;
    }

    if (token.type === "function") {
      if (stack.length < 1) {
        throw new Error("Incomplete expression");
      }
      const value = stack.pop();
      stack.push(applyScientificFunction(token.value, value, angleMode));
      return;
    }

    if (token.type === "operator") {
      const config = OPERATOR_CONFIG[token.value];
      if (!config) {
        throw new Error(`Unsupported operator "${token.value}"`);
      }

      if (config.args === 1) {
        if (stack.length < 1) {
          throw new Error("Incomplete expression");
        }
        const value = stack.pop();
        stack.push(ensureFiniteResult(config.evaluate(value)));
        return;
      }

      if (stack.length < 2) {
        throw new Error("Incomplete expression");
      }

      const right = stack.pop();
      const left = stack.pop();
      stack.push(ensureFiniteResult(config.evaluate(left, right)));
    }
  });

  if (stack.length !== 1) {
    throw new Error("Incomplete expression");
  }

  return ensureFiniteResult(stack[0]);
}

export function evaluateCalculatorExpression(
  expression,
  { answer = 0, angleMode = "DEG" } = {}
) {
  const normalizedExpression = normalizeCalculatorExpression(expression);

  if (!normalizedExpression) {
    return 0;
  }

  const tokens = normalizeTokens(tokenizeExpression(normalizedExpression));
  const rpn = toReversePolishNotation(tokens);
  return evaluateReversePolishNotation(rpn, { answer, angleMode });
}

export function formatCalculatorNumber(value) {
  const normalized = ensureFiniteResult(value);
  if (normalized === 0) {
    return "0";
  }

  const absoluteValue = Math.abs(normalized);
  const compactExponential = (input) =>
    input.replace(/(\.\d*?[1-9])0+e/, "$1e").replace(/\.0+e/, "e");

  if (absoluteValue >= 1e12 || absoluteValue < 1e-9) {
    return compactExponential(normalized.toExponential(6));
  }

  const formatted = normalized.toPrecision(12);
  if (formatted.includes("e")) {
    return compactExponential(formatted);
  }

  return formatted.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}
