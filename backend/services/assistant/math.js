const normalizeText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const stripLeadingPromptWords = (value = "") =>
  normalizeText(value)
    .replace(/^(please\s+)?(solve|calculate|work out|work out for me|check|evaluate|find|what is|what's|compute|help me solve)\b[:\s-]*/i, "")
    .trim();

const isValidMathExpression = (expression = "") =>
  /^[0-9+\-*/^().,\s]+$/.test(String(expression || "").replace(/,/g, ""));

const extractMathExpression = (message = "") => {
  const stripped = stripLeadingPromptWords(message);
  if (isValidMathExpression(stripped)) {
    return stripped;
  }

  const compact = String(message || "").replace(/,/g, " ");
  const matches = compact.match(/[0-9][0-9\s+\-*/^().,]*[0-9]/g);
  if (matches && matches.length > 0) {
    const candidate = matches[matches.length - 1].trim();
    if (isValidMathExpression(candidate)) {
      return candidate;
    }
  }

  return "";
};

const tokenize = (expression = "") => {
  const source = String(expression || "").replace(/,/g, "");
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let next = index + 1;
      while (next < source.length && /[0-9.]/.test(source[next])) {
        next += 1;
      }
      tokens.push({ type: "number", value: Number(source.slice(index, next)) });
      index = next;
      continue;
    }

    if ("+-*/^()".includes(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    return null;
  }

  return tokens;
};

const makeNode = (type, value, left = null, right = null) => ({ type, value, left, right });

const parseExpression = (tokens = []) => {
  let position = 0;

  const peek = () => tokens[position];
  const consume = () => tokens[position++];

  const parsePrimary = () => {
    const token = peek();
    if (!token) {
      return null;
    }

    if (token.type === "operator" && token.value === "(") {
      consume();
      const expr = parseAddSub();
      const closing = consume();
      if (!closing || closing.value !== ")") {
        return null;
      }
      return expr;
    }

    if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
      consume();
      const operand = parsePrimary();
      if (!operand) {
        return null;
      }
      if (token.value === "+") {
        return operand;
      }
      return makeNode("unary", "-", operand);
    }

    if (token.type === "number") {
      consume();
      return makeNode("number", token.value);
    }

    return null;
  };

  const parsePower = () => {
    let left = parsePrimary();
    if (!left) {
      return null;
    }

    while (peek()?.type === "operator" && peek().value === "^") {
      consume();
      const right = parsePrimary();
      if (!right) {
        return null;
      }
      left = makeNode("binary", "^", left, right);
    }

    return left;
  };

  const parseMulDiv = () => {
    let left = parsePower();
    if (!left) {
      return null;
    }

    while (peek()?.type === "operator" && ["*", "/"].includes(peek().value)) {
      const operator = consume().value;
      const right = parsePower();
      if (!right) {
        return null;
      }
      left = makeNode("binary", operator, left, right);
    }

    return left;
  };

  const parseAddSub = () => {
    let left = parseMulDiv();
    if (!left) {
      return null;
    }

    while (peek()?.type === "operator" && ["+", "-"].includes(peek().value)) {
      const operator = consume().value;
      const right = parseMulDiv();
      if (!right) {
        return null;
      }
      left = makeNode("binary", operator, left, right);
    }

    return left;
  };

  const ast = parseAddSub();
  if (!ast || position !== tokens.length) {
    return null;
  }

  return ast;
};

const formatNumber = (value) => {
  if (!Number.isFinite(value)) {
    return "NaN";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  const rounded = Number(value.toFixed(10));
  return String(rounded);
};

const evaluateAst = (node, steps = []) => {
  if (!node) {
    return { value: NaN, steps };
  }

  if (node.type === "number") {
    return { value: node.value, steps };
  }

  if (node.type === "unary") {
    const operand = evaluateAst(node.left, steps);
    const value = node.value === "-" ? -operand.value : operand.value;
    steps.push(`${node.value}${formatNumber(operand.value)} = ${formatNumber(value)}`);
    return { value, steps };
  }

  const left = evaluateAst(node.left, steps);
  const right = evaluateAst(node.right, steps);
  let value = NaN;

  if (node.value === "+") value = left.value + right.value;
  if (node.value === "-") value = left.value - right.value;
  if (node.value === "*") value = left.value * right.value;
  if (node.value === "/") value = right.value === 0 ? NaN : left.value / right.value;
  if (node.value === "^") value = left.value ** right.value;

  steps.push(`${formatNumber(left.value)} ${node.value} ${formatNumber(right.value)} = ${formatNumber(value)}`);
  return { value, steps };
};

const solveMathExpression = (expression = "") => {
  const cleaned = normalizeText(expression).replace(/[=]$/, "");
  if (!cleaned || !isValidMathExpression(cleaned)) {
    return null;
  }

  const tokens = tokenize(cleaned);
  if (!tokens) {
    return null;
  }

  const ast = parseExpression(tokens);
  if (!ast) {
    return null;
  }

  const steps = [];
  const result = evaluateAst(ast, steps);
  if (!Number.isFinite(result.value)) {
    return null;
  }

  return {
    expression: cleaned,
    answer: result.value,
    steps,
    answerText: formatNumber(result.value),
  };
};

const buildMathResponse = ({ message = "", expression = "" } = {}) => {
  const sourceExpression = String(expression || "").trim() || extractMathExpression(message);
  const solved = solveMathExpression(sourceExpression);
  if (!solved) {
    return null;
  }

  return {
    mode: "math",
    safety: {
      level: "safe",
      notice: "",
      escalation: "",
    },
    message: `The answer is ${solved.answerText}.`,
    details: [
      {
        title: "Expression",
        body: solved.expression,
      },
      {
        title: "Steps",
        body: solved.steps.length > 0 ? solved.steps.join("\n") : "I used the standard order of operations.",
      },
    ],
    followUps: [
      { label: "Check my answer", prompt: `Check this answer again: ${solved.expression}` },
      { label: "Another problem", prompt: "Solve another math problem step by step" },
    ],
    answer: solved.answer,
    expression: solved.expression,
    answerText: solved.answerText,
    steps: solved.steps,
  };
};

module.exports = {
  buildMathResponse,
  formatNumber,
  extractMathExpression,
  isValidMathExpression,
  solveMathExpression,
};
