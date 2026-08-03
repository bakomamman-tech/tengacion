const fs = require("node:fs");
const path = require("node:path");

const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const sourceRoot = path.resolve(__dirname, "../src");
const sourceExtensions = new Set([".js", ".jsx"]);
const ignoredDirectories = new Set(["__tests__"]);

const listSourceFiles = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : listSourceFiles(absolutePath);
    }
    if (!sourceExtensions.has(path.extname(entry.name)) || /\.test\.[jt]sx?$/.test(entry.name)) {
      return [];
    }
    return [absolutePath];
  });

const getAttribute = (attributes, name) =>
  attributes.find(
    (attribute) => attribute.type === "JSXAttribute" && attribute.name?.name === name
  );

const hasAttribute = (attributes, names) =>
  names.some((name) => Boolean(getAttribute(attributes, name)));

const getStaticAttributeValue = (attribute) => {
  if (!attribute) {
    return "";
  }
  if (!attribute.value) {
    return true;
  }
  if (attribute.value.type === "StringLiteral") {
    return attribute.value.value;
  }
  if (
    attribute.value.type === "JSXExpressionContainer" &&
    ["StringLiteral", "BooleanLiteral"].includes(attribute.value.expression?.type)
  ) {
    return attribute.value.expression.value;
  }
  return null;
};

const hasSpreadAttributes = (attributes) =>
  attributes.some((attribute) => attribute.type === "JSXSpreadAttribute");

const isInsideSubmittingForm = (jsxPath) => {
  const formPath = jsxPath.findParent(
    (parent) =>
      parent.isJSXElement() && parent.node.openingElement?.name?.name === "form"
  );
  return Boolean(
    formPath && hasAttribute(formPath.node.openingElement.attributes || [], ["onSubmit", "action"])
  );
};

const getLabel = (openingPath) => {
  const attributes = openingPath.node.attributes || [];
  const explicit = ["aria-label", "title"]
    .map((name) => getStaticAttributeValue(getAttribute(attributes, name)))
    .find((value) => typeof value === "string" && value.trim());
  if (explicit) {
    return explicit.trim();
  }

  const element = openingPath.parentPath?.node;
  if (element?.type !== "JSXElement") {
    return "unlabelled control";
  }
  const text = element.children
    .filter((child) => child.type === "JSXText")
    .map((child) => child.value)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text || "dynamic-label control";
};

const findings = [];

listSourceFiles(sourceRoot).forEach((filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  const ast = parser.parse(source, {
    sourceType: "module",
    plugins: ["jsx"],
  });

  traverse(ast, {
    JSXOpeningElement(openingPath) {
      const elementName = openingPath.node.name?.name;
      const attributes = openingPath.node.attributes || [];
      const relativePath = path.relative(path.resolve(__dirname, ".."), filePath).replaceAll("\\", "/");
      const line = openingPath.node.loc?.start?.line || 1;
      const label = getLabel(openingPath);

      if (elementName === "button") {
        const type = getStaticAttributeValue(getAttribute(attributes, "type"));
        const isDisabled = hasAttribute(attributes, ["disabled"]);
        const hasAction = hasAttribute(attributes, [
          "onClick",
          "onPointerDown",
          "onMouseDown",
          "formAction",
        ]);
        const submitsForm =
          (type === "submit" || type === "" || type === null) &&
          (isInsideSubmittingForm(openingPath) || hasAttribute(attributes, ["form"]));
        if (!isDisabled && !hasAction && !submitsForm && !hasSpreadAttributes(attributes)) {
          findings.push({ file: relativePath, line, element: "button", label });
        }

        const clickAttribute = getAttribute(attributes, "onClick");
        const clickSource = clickAttribute
          ? source.slice(clickAttribute.start || 0, clickAttribute.end || 0)
          : "";
        if (!isDisabled && /coming\s+(soon|next)|not\s+yet\s+available/i.test(clickSource)) {
          findings.push({ file: relativePath, line, element: "placeholder button", label });
        }
      }

      if (elementName === "a") {
        const hrefAttribute = getAttribute(attributes, "href");
        const href = getStaticAttributeValue(hrefAttribute);
        const hasAction = hasAttribute(attributes, ["onClick"]);
        const isDisabled = hasAttribute(attributes, ["disabled", "aria-disabled"]);
        if (
          !isDisabled &&
          !hasAction &&
          !hasSpreadAttributes(attributes) &&
          (!hrefAttribute || href === "" || href === "#")
        ) {
          findings.push({ file: relativePath, line, element: "link", label });
        }
      }
    },
  });
});

if (findings.length) {
  console.error(`Found ${findings.length} inert interactive control(s):`);
  findings.forEach((finding) => {
    console.error(
      `- ${finding.file}:${finding.line} ${finding.element} "${finding.label}" has no action or honest disabled state`
    );
  });
  process.exitCode = 1;
} else {
  console.log("Inert-control audit passed: every native button and link has an action or disabled state.");
}
