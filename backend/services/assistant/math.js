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

const TRIG_RATIO_ALIASES = {
  sin: "sin",
  cos: "cos",
  tan: "tan",
  cot: "cot",
  sec: "sec",
  csc: "csc",
  cosec: "csc",
};

const normalizeTrigRatio = (value = "") => TRIG_RATIO_ALIASES[String(value || "").toLowerCase()] || "";

const formatRatio = (numerator = "", denominator = "") => {
  if (!numerator || !denominator) {
    return "";
  }
  if (denominator === "1") {
    return numerator;
  }
  if (numerator === "1") {
    return `1 / ${denominator}`;
  }
  return `${numerator} / ${denominator}`;
};

const getTrigRatioDefinition = (ratio = "") => {
  if (ratio === "sin") return "opposite / hypotenuse";
  if (ratio === "cos") return "adjacent / hypotenuse";
  if (ratio === "tan") return "opposite / adjacent";
  if (ratio === "cot") return "adjacent / opposite";
  if (ratio === "sec") return "hypotenuse / adjacent";
  if (ratio === "csc") return "hypotenuse / opposite";
  return "";
};

const getTrigTriangleSides = ({ ratio, value }) => {
  if (ratio === "sin") {
    return {
      opposite: value,
      adjacent: `sqrt(1 - ${value}^2)`,
      hypotenuse: "1",
      missingSideStep: `adjacent = sqrt(1^2 - ${value}^2) = sqrt(1 - ${value}^2)`,
    };
  }
  if (ratio === "cos") {
    return {
      opposite: `sqrt(1 - ${value}^2)`,
      adjacent: value,
      hypotenuse: "1",
      missingSideStep: `opposite = sqrt(1^2 - ${value}^2) = sqrt(1 - ${value}^2)`,
    };
  }
  if (ratio === "tan") {
    return {
      opposite: value,
      adjacent: "1",
      hypotenuse: `sqrt(1 + ${value}^2)`,
      missingSideStep: `hypotenuse = sqrt(${value}^2 + 1^2) = sqrt(1 + ${value}^2)`,
    };
  }
  if (ratio === "cot") {
    return {
      opposite: "1",
      adjacent: value,
      hypotenuse: `sqrt(1 + ${value}^2)`,
      missingSideStep: `hypotenuse = sqrt(1^2 + ${value}^2) = sqrt(1 + ${value}^2)`,
    };
  }
  if (ratio === "sec") {
    return {
      opposite: `sqrt(${value}^2 - 1)`,
      adjacent: "1",
      hypotenuse: value,
      missingSideStep: `opposite = sqrt(${value}^2 - 1^2) = sqrt(${value}^2 - 1)`,
    };
  }
  if (ratio === "csc") {
    return {
      opposite: "1",
      adjacent: `sqrt(${value}^2 - 1)`,
      hypotenuse: value,
      missingSideStep: `adjacent = sqrt(${value}^2 - 1^2) = sqrt(${value}^2 - 1)`,
    };
  }
  return null;
};

const getTrigRatioFromSides = ({ ratio, sides }) => {
  if (!sides) {
    return "";
  }
  if (ratio === "sin") return formatRatio(sides.opposite, sides.hypotenuse);
  if (ratio === "cos") return formatRatio(sides.adjacent, sides.hypotenuse);
  if (ratio === "tan") return formatRatio(sides.opposite, sides.adjacent);
  if (ratio === "cot") return formatRatio(sides.adjacent, sides.opposite);
  if (ratio === "sec") return formatRatio(sides.hypotenuse, sides.adjacent);
  if (ratio === "csc") return formatRatio(sides.hypotenuse, sides.opposite);
  return "";
};

const extractTrigIdentityProblem = (message = "") => {
  const source = normalizeMathProblemText(message);
  const given = source.match(
    /\b(sin|cos|tan|cot|sec|csc|cosec)\s*\(?\s*theta\s*\)?\s*=\s*([a-z][a-z0-9_]*|\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)/i
  );
  const target = source.match(
    /\b(?:find|calculate|solve|determine|what is|work out)\b.*?\b(sin|cos|tan|cot|sec|csc|cosec)\s*\(?\s*theta\s*\)?/i
  );

  if (!given || !target) {
    return null;
  }

  const givenRatio = normalizeTrigRatio(given[1]);
  const targetRatio = normalizeTrigRatio(target[1]);
  const value = given[2].replace(/\s+/g, "");
  if (!givenRatio || !targetRatio || givenRatio === targetRatio) {
    return null;
  }

  const firstQuadrant =
    /\b0\s*(?:degrees?)?\s*(?:<=|<|to|-)\s*theta\s*(?:<=|<|to|-)\s*90\s*(?:degrees?)?\b/i.test(source) ||
    /\bfirst quadrant\b/i.test(source) ||
    /\bacute angle\b/i.test(source);

  return {
    givenRatio,
    targetRatio,
    value,
    firstQuadrant,
  };
};

const extractSinToTanIdentity = (message = "") => {
  const problem = extractTrigIdentityProblem(message);
  if (!problem || problem.givenRatio !== "sin" || problem.targetRatio !== "tan") {
    return null;
  }
  return problem;
};

const buildFormulaBlock = (lines = []) =>
  ["```math", ...lines.filter(Boolean), "```"].join("\n");

const greatestCommonDivisor = (left, right) => {
  let a = Math.abs(Number(left));
  let b = Math.abs(Number(right));
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
};

const leastCommonMultiple = (left, right) =>
  Math.abs(Number(left) * Number(right)) / greatestCommonDivisor(left, right);

const formatFractionTerms = (terms = [], numeratorKey = "numerator") =>
  terms
    .map((term, index) => {
      const numerator = Math.abs(term[numeratorKey]);
      const fraction = `${numerator}/${term.denominator}`;
      if (index === 0) {
        return term[numeratorKey] < 0 ? `-${fraction}` : fraction;
      }
      return `${term[numeratorKey] < 0 ? "-" : "+"} ${fraction}`;
    })
    .join(" ");

const parseFractionAdditionExpression = (value = "") => {
  const compact = stripLeadingPromptWords(value)
    .replace(/\s+/g, "")
    .replace(/[?.]+$/, "");

  if (!/^[+-]?\d+\/[1-9]\d*(?:[+-]\d+\/[1-9]\d*)*$/.test(compact)) {
    return null;
  }

  const terms = Array.from(compact.matchAll(/([+-]?)(\d+)\/([1-9]\d*)/g)).map(
    (match) => ({
      numerator: (match[1] === "-" ? -1 : 1) * Number(match[2]),
      denominator: Number(match[3]),
    })
  );

  return terms.length > 0 ? terms : null;
};

const formatMixedNumber = (numerator, denominator) => {
  const sign = numerator < 0 ? "-" : "";
  const absoluteNumerator = Math.abs(numerator);
  const whole = Math.floor(absoluteNumerator / denominator);
  const remainder = absoluteNumerator % denominator;
  return remainder ? `${sign}${whole} ${remainder}/${denominator}` : `${sign}${whole}`;
};

const buildFractionAdditionResponse = (terms = []) => {
  const commonDenominator = terms.reduce(
    (current, term) => leastCommonMultiple(current, term.denominator),
    1
  );
  const convertedTerms = terms.map((term) => ({
    ...term,
    convertedNumerator: term.numerator * (commonDenominator / term.denominator),
    denominator: commonDenominator,
  }));
  const combinedNumerator = convertedTerms.reduce(
    (total, term) => total + term.convertedNumerator,
    0
  );
  const divisor = greatestCommonDivisor(combinedNumerator, commonDenominator);
  const simplifiedNumerator = combinedNumerator / divisor;
  const simplifiedDenominator = commonDenominator / divisor;
  const isImproper = Math.abs(simplifiedNumerator) > simplifiedDenominator;
  const simplifiedText =
    simplifiedDenominator === 1
      ? String(simplifiedNumerator)
      : `${simplifiedNumerator}/${simplifiedDenominator}`;
  const finalAnswer = isImproper
    ? formatMixedNumber(simplifiedNumerator, simplifiedDenominator)
    : simplifiedText;
  const expression = formatFractionTerms(terms);
  const convertedExpression = formatFractionTerms(
    convertedTerms,
    "convertedNumerator"
  );
  const numeratorCalculation = convertedTerms
    .map((term, index) => {
      const value = Math.abs(term.convertedNumerator);
      if (index === 0) return term.convertedNumerator < 0 ? `-${value}` : String(value);
      return `${term.convertedNumerator < 0 ? "-" : "+"} ${value}`;
    })
    .join(" ");
  const conversionBlocks = terms.flatMap((term, index) => {
    const converted = convertedTerms[index];
    const original = `${term.numerator < 0 ? "-" : ""}${Math.abs(term.numerator)}/${term.denominator}`;
    const replacement = `${converted.convertedNumerator < 0 ? "-" : ""}${Math.abs(converted.convertedNumerator)}/${commonDenominator}`;
    return [buildFormulaBlock([`${original} = ${replacement}`]), ""];
  });
  const steps = [
    `The denominators are ${terms.map((term) => term.denominator).join(", ")}, so the LCM is ${commonDenominator}.`,
    `Convert each fraction to denominator ${commonDenominator}: ${convertedExpression}.`,
    `Combine the numerators: ${numeratorCalculation} = ${combinedNumerator}.`,
    `Simplify ${combinedNumerator}/${commonDenominator} to ${simplifiedText}.`,
    ...(isImproper ? [`Convert ${simplifiedText} to the mixed number ${finalAnswer}.`] : []),
  ];
  const solutionText = [
    "The problem is:",
    buildFormulaBlock([expression]),
    "",
    "### Step 1: Find the LCM",
    `The denominators are **${terms.map((term) => term.denominator).join(", ")}**.`,
    buildFormulaBlock([`LCM = ${commonDenominator}`]),
    "",
    "### Step 2: Convert each fraction",
    ...conversionBlocks,
    "### Step 3: Add and subtract",
    buildFormulaBlock([convertedExpression]),
    "",
    buildFormulaBlock([
      `(${numeratorCalculation})/${commonDenominator} = ${combinedNumerator}/${commonDenominator}`,
    ]),
    "",
    "### Step 4: Simplify",
    buildFormulaBlock([`${combinedNumerator}/${commonDenominator} = ${simplifiedText}`]),
    ...(isImproper
      ? [
          "",
          "As a mixed number:",
          buildFormulaBlock([`${simplifiedText} = ${finalAnswer}`]),
        ]
      : []),
    "",
    "### Final Answer",
    buildFormulaBlock([`\\boxed{${finalAnswer}}`]),
  ].join("\n");

  return {
    mode: "math",
    safety: { level: "safe", notice: "", escalation: "" },
    message: solutionText,
    details: [
      { title: "Expression", body: expression },
      { title: "Steps", body: steps.join("\n") },
    ],
    followUps: [
      { label: "Check my answer", prompt: `Check this fraction answer again: ${expression}` },
      { label: "Another fraction", prompt: "Solve another fraction problem step by step" },
    ],
    answer: combinedNumerator / commonDenominator,
    expression,
    answerText: finalAnswer,
    solutionText,
    steps,
  };
};

const buildTrigIdentityResponse = ({ givenRatio, targetRatio, value, firstQuadrant }) => {
  const sides = getTrigTriangleSides({ ratio: givenRatio, value });
  const answerText = getTrigRatioFromSides({ ratio: targetRatio, sides });
  if (!sides || !answerText) {
    return null;
  }

  const expression = `${givenRatio}(theta) = ${value}; find ${targetRatio}(theta)`;
  const domainNote = [
    "This first-quadrant formula uses the positive square root.",
    "If the denominator in the final expression becomes 0, the requested ratio is undefined.",
  ].join(" ");
  const givenDefinition = getTrigRatioDefinition(givenRatio);
  const targetDefinition = getTrigRatioDefinition(targetRatio);
  const steps = [
    firstQuadrant
      ? "Because 0 <= theta <= 90 degrees, theta is in the first quadrant, so the requested ratio is non-negative where it is defined."
      : "Use the positive adjacent side for an acute first-quadrant angle.",
    `${givenRatio}(theta) = ${givenDefinition}, so set the matching sides from ${givenRatio}(theta) = ${value}.`,
    `${sides.missingSideStep}.`,
    `${targetRatio}(theta) = ${targetDefinition} = ${answerText}.`,
    domainNote,
  ];
  const solutionText = [
    "## Problem",
    "Use the given trigonometric ratio to find the requested ratio.",
    buildFormulaBlock([expression]),
    "",
    "## Given",
    buildFormulaBlock([
      `${givenRatio}(theta) = ${value}`,
      firstQuadrant ? "0 degrees <= theta <= 90 degrees" : "",
    ]),
    firstQuadrant
      ? "The angle is in the first quadrant, so the side lengths and requested ratio are non-negative where they are defined."
      : "Treat the angle as an acute first-quadrant angle, so use the positive side length.",
    "",
    "## Step 1: Write the known ratio",
    "Start with the definition of the ratio given in the problem.",
    buildFormulaBlock([`${givenRatio}(theta) = ${givenDefinition}`]),
    "",
    "Choose convenient side lengths that represent this ratio.",
    buildFormulaBlock([
      `opposite = ${sides.opposite}`,
      `adjacent = ${sides.adjacent}`,
      `hypotenuse = ${sides.hypotenuse}`,
    ]),
    "",
    "## Step 2: Find the missing side",
    "Use the Pythagorean theorem to calculate the side that is still unknown.",
    buildFormulaBlock([sides.missingSideStep]),
    "",
    "## Step 3: Calculate the requested ratio",
    `Now use ${targetRatio}(theta) = ${targetDefinition} and substitute the side lengths.`,
    buildFormulaBlock([
      `${targetRatio}(theta) = ${targetDefinition}`,
      `${targetRatio}(theta) = ${answerText}`,
    ]),
    "",
    "## Final Answer",
    buildFormulaBlock([`\\boxed{${targetRatio}(theta) = ${answerText}}`]),
    "",
    "## Check",
    "The side lengths satisfy the Pythagorean relationship used in Step 2.",
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
      { label: "Check my answer", prompt: `Check why ${targetRatio}(theta) = ${answerText}` },
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

const looksLikeWeakImageMathExtraction = ({ message = "", expression = "" } = {}) => {
  const originalMessage = String(message || "");
  const extractedExpression = normalizeMathProblemText(expression || "").trim();

  const userMentionsImage = /\b(image|picture|photo|screenshot|attached|uploaded|visible|spoken)\b/i.test(
    originalMessage
  );
  const userExpectedFraction = /\b(fraction|numerator|denominator|simplify|calculate|solve|expression)\b/i.test(
    originalMessage
  );
  const extractedIsOnlyDigits = /^\d{3,}$/.test(extractedExpression);
  const messageAlreadyContainsFraction = /-?\d+\s*\/\s*-?\d+/.test(originalMessage);

  return (
    userMentionsImage &&
    userExpectedFraction &&
    extractedIsOnlyDigits &&
    !messageAlreadyContainsFraction
  );
};

const buildUnclearImageMathResponse = () => ({
  message:
    "I cannot clearly read the full fraction from the image. Please type the fraction or upload a clearer image, and I will solve it step by step.",
  details: [
    "The image appears to contain a fraction problem, but the extracted text is incomplete.",
    "I should not guess the numerator, denominator, or operators from unclear image text.",
  ],
  followUps: [
    { label: "Type the fraction", prompt: "The fraction is " },
    {
      label: "Upload clearer image",
      prompt: "I will upload a clearer image of the fraction problem.",
    },
  ],
  mode: "math",
  confidence: 0.72,
});

const buildMathResponse = ({ message = "", expression = "" } = {}) => {
  if (looksLikeWeakImageMathExtraction({ message, expression })) {
    return buildUnclearImageMathResponse();
  }

  const fractionTerms = parseFractionAdditionExpression(expression || message);
  if (fractionTerms) {
    return buildFractionAdditionResponse(fractionTerms);
  }

  const trigIdentity = expression ? null : extractTrigIdentityProblem(message);
  if (trigIdentity) {
    return buildTrigIdentityResponse(trigIdentity);
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
  const calculationSteps =
    solved.steps.length > 0
      ? solved.steps
      : [`${displayExpression} = ${solved.answerText}`];
  const arithmeticSolutionText = [
    "## Problem",
    "Calculate the following expression.",
    buildFormulaBlock([displayExpression]),
    "",
    ...(percentExpression
      ? [
          "## Given",
          "To find a percentage of a number, change the percentage to a fraction over 100 and multiply.",
          buildFormulaBlock([percentExpression.expression]),
          "",
        ]
      : []),
    ...calculationSteps.flatMap((step, index) => [
      `## Step ${index + 1}${index === 0 ? ": Begin the calculation" : ": Continue the calculation"}`,
      index === 0
        ? "Use the standard order of operations and evaluate the first part that can be simplified."
        : "Substitute the previous result and simplify the next part.",
      buildFormulaBlock([step]),
      "",
    ]),
    "",
    "## Final Answer",
    `The final answer is ${solved.answerText}.`,
    buildFormulaBlock([`\\boxed{${solved.answerText}}`]),
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
  buildFractionAdditionResponse,
  extractTrigIdentityProblem,
  extractSinToTanIdentity,
  extractPercentOfExpression,
  formatNumber,
  extractMathExpression,
  isValidMathExpression,
  parseFractionAdditionExpression,
  solveMathExpression,
};
