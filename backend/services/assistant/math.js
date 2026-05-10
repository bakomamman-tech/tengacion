const normalizeText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const stripLeadingPromptWords = (value = "") =>
  normalizeText(value)
    .replace(/^(please\s+)?(solve|calculate|work out|work out for me|check|evaluate|find|what is|what's|compute|help me solve)\b[:\s-]*/i, "")
    .trim();

const normalizeMathProblemText = (value = "") =>
  normalizeText(value)
    .replace(/[\u03b8\u0398]/g, "theta")
    .replace(/\u2264/g, "<=")
    .replace(/\u2265/g, ">=")
    .replace(/\u00b0/g, " degrees");

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

const extractPercentOfExpression = (message = "") => {
  const source = normalizeText(message);
  const match = source.match(
    /(\d+(?:\.\d+)?)\s*(?:percent|%)\s+(?:of|from)\s+(\d+(?:\.\d+)?)/i
  );

  if (!match) {
    return null;
  }

  const percent = Number(match[1]);
  const base = Number(match[2]);
  if (!Number.isFinite(percent) || !Number.isFinite(base)) {
    return null;
  }

  return {
    display: `${formatNumber(percent)}% of ${formatNumber(base)}`,
    expression: `${formatNumber(base)} * (${formatNumber(percent)} / 100)`,
  };
};

const extractSinToTanIdentity = (message = "") => {
  const source = normalizeMathProblemText(message);
  const given = source.match(
    /\bsin\s*\(?\s*theta\s*\)?\s*=\s*([a-z][a-z0-9_]*|\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)/i
  );
  const asksForTan =
    /\b(?:find|calculate|solve|determine|what is|work out)\b.*\btan\s*\(?\s*theta\s*\)?/i.test(source) ||
    /\btan\s*\(?\s*theta\s*\)?/i.test(source);

  if (!given || !asksForTan) {
    return null;
  }

  const value = given[1].replace(/\s+/g, "");
  const firstQuadrant =
    /\b0\s*(?:degrees?)?\s*(?:<=|<|to|-)\s*theta\s*(?:<=|<|to|-)\s*90\s*(?:degrees?)?\b/i.test(source) ||
    /\bfirst quadrant\b/i.test(source) ||
    /\bacute angle\b/i.test(source);

  return {
    value,
    firstQuadrant,
  };
};

const buildFormulaBlock = (lines = []) =>
  ["```math", ...lines.filter(Boolean), "```"].join("\n");

const buildSinToTanResponse = ({ value, firstQuadrant }) => {
  const answerText = `${value} / sqrt(1 - ${value}^2)`;
  const expression = `sin(theta) = ${value}; find tan(theta)`;
  const domainNote = `This formula works for 0 <= ${value} < 1; if ${value} = 1, theta = 90 degrees and tan(theta) is undefined.`;
  const steps = [
    firstQuadrant
      ? "Because 0 <= theta <= 90 degrees, theta is in the first quadrant, so the tangent value is non-negative."
      : "Use the positive adjacent side for an acute first-quadrant angle.",
    `sin(theta) = opposite / hypotenuse = ${value} / 1, so take opposite = ${value} and hypotenuse = 1.`,
    `adjacent = sqrt(1^2 - ${value}^2) = sqrt(1 - ${value}^2).`,
    `tan(theta) = opposite / adjacent = ${answerText}.`,
    domainNote,
  ];
  const solutionText = [
    "## Given",
    buildFormulaBlock([
      `sin(theta) = ${value}`,
      firstQuadrant ? "0 degrees <= theta <= 90 degrees" : "",
    ]),
    firstQuadrant
      ? "For 0 degrees <= theta <= 90 degrees, theta is in the first quadrant, so all trigonometric values are positive."
      : "Use the positive adjacent side for an acute first-quadrant angle.",
    "",
    "## Using",
    buildFormulaBlock(["sin(theta) = opposite / hypotenuse"]),
    "",
    "## Let",
    buildFormulaBlock([`opposite = ${value}`, "hypotenuse = 1"]),
    "",
    "Then the adjacent side is:",
    buildFormulaBlock([`adjacent = sqrt(1^2 - ${value}^2) = sqrt(1 - ${value}^2)`]),
    "",
    "## So",
    buildFormulaBlock([
      "tan(theta) = opposite / adjacent",
      `tan(theta) = ${answerText}`,
    ]),
    "",
    "## Final answer",
    buildFormulaBlock([`tan(theta) = ${answerText}`]),
    domainNote,
  ].join("\n");

  return {
    mode: "math",
    safety: {
      level: "safe",
      notice: "",
      escalation: "",
    },
    message: solutionText,
    details: [
      {
        title: "Expression",
        body: expression,
      },
      {
        title: "Steps",
        body: steps.join("\n"),
      },
    ],
    followUps: [
      { label: "Check my answer", prompt: `Check why tan(theta) = ${answerText}` },
      { label: "Another trig problem", prompt: "Solve another trigonometry problem step by step" },
    ],
    answer: answerText,
    expression,
    answerText,
    solutionText,
    steps,
  };
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
  const sinToTanIdentity = expression ? null : extractSinToTanIdentity(message);
  if (sinToTanIdentity) {
    return buildSinToTanResponse(sinToTanIdentity);
  }

  const percentExpression = expression ? null : extractPercentOfExpression(message);
  const sourceExpression =
    String(expression || "").trim() ||
    percentExpression?.expression ||
    extractMathExpression(message);
  const solved = solveMathExpression(sourceExpression);
  if (!solved) {
    return null;
  }
  const displayExpression = percentExpression?.display || solved.expression;
  const arithmeticSolutionText = [
    `The answer is ${solved.answerText}.`,
    "",
    "## Expression",
    buildFormulaBlock([displayExpression]),
    "",
    "## Steps",
    ...(solved.steps.length > 0
      ? solved.steps.map((step, index) => `${index + 1}. ${step}`)
      : ["1. I used the standard order of operations."]),
    "",
    "## Final answer",
    buildFormulaBlock([solved.answerText]),
  ].join("\n");

  return {
    mode: "math",
    safety: {
      level: "safe",
      notice: "",
      escalation: "",
    },
    message: arithmeticSolutionText,
    details: [
      {
        title: "Expression",
        body: displayExpression,
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
    expression: displayExpression,
    answerText: solved.answerText,
    solutionText: arithmeticSolutionText,
    steps: solved.steps,
  };
};

module.exports = {
  buildMathResponse,
  extractSinToTanIdentity,
  extractPercentOfExpression,
  formatNumber,
  extractMathExpression,
  isValidMathExpression,
  solveMathExpression,
};
