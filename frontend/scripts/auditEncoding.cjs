const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "../..");
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".htm",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".plist",
  ".properties",
  ".scss",
  ".storyboard",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".xcprivacy",
  ".xml",
  ".yaml",
  ".yml",
]);
const ignoredDirectories = new Set([
  ".git",
  ".gradle",
  ".tmp",
  "Pods",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "output",
  "uploads",
]);
const ignoredFiles = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
const generatedMobileRoots = new Set([
  "frontend/android/app/src/main/assets/public",
  "frontend/ios/App/App/public",
]);
const fromCodePoint = (value) => String.fromCodePoint(value);
const windows1252ContinuationCodePoints = [
  0x20ac,
  0x201a,
  0x0192,
  0x201e,
  0x2026,
  0x2020,
  0x2021,
  0x02c6,
  0x2030,
  0x0160,
  0x2039,
  0x0152,
  0x017d,
  0x2018,
  0x2019,
  0x201c,
  0x201d,
  0x2022,
  0x2013,
  0x2014,
  0x02dc,
  0x2122,
  0x0161,
  0x203a,
  0x0153,
  0x017e,
  0x0178,
];
const continuationCharacters = [
  ...Array.from({ length: 0x40 }, (_, index) => fromCodePoint(0x80 + index)),
  ...windows1252ContinuationCodePoints.map(fromCodePoint),
].join("");
const escapeCharacterClass = (value) => value.replace(/[\\\]^-]/g, "\\$&");
const continuationClass = escapeCharacterClass(continuationCharacters);
const mojibakePatterns = [
  {
    expression: new RegExp(`${fromCodePoint(0x00c2)}[${continuationClass}]`, "gu"),
    label: "Latin-1 mojibake sequence",
  },
  {
    expression: new RegExp(`${fromCodePoint(0x00c3)}[${continuationClass}]`, "gu"),
    label: "Latin-1 mojibake sequence",
  },
  {
    expression: new RegExp(`${fromCodePoint(0x00e2)}[${continuationClass}]`, "gu"),
    label: "Windows-1252 mojibake sequence",
  },
  {
    expression: new RegExp(`${fromCodePoint(0x00f0)}[${continuationClass}]`, "gu"),
    label: "corrupted emoji sequence",
  },
  {
    expression: new RegExp(
      `${fromCodePoint(0x00ef)}(?:${fromCodePoint(0x00bf)}${fromCodePoint(0x00bd)}|${fromCodePoint(0x00bb)}${fromCodePoint(0x00bf)})`,
      "gu"
    ),
    label: "double-decoded UTF-8 sequence",
  },
];
const corruptHtmlEntities = [
  ["&A", "circ;"].join(""),
  ["&A", "tilde;"].join(""),
  ["&a", "circ;"].join(""),
  ["&e", "th;"].join(""),
  ["&#", "65533;"].join(""),
];

const isIgnoredDirectory = (name) =>
  ignoredDirectories.has(name) || name.startsWith(".tmp-");

const isGeneratedMobileDirectory = (directory) =>
  generatedMobileRoots.has(
    path.relative(repositoryRoot, directory).replaceAll("\\", "/")
  );

const isTextFile = (filePath) =>
  textExtensions.has(path.extname(filePath).toLowerCase()) &&
  !ignoredFiles.has(path.basename(filePath));

const listTextFiles = (directory = repositoryRoot) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return isIgnoredDirectory(entry.name) || isGeneratedMobileDirectory(absolutePath)
        ? []
        : listTextFiles(absolutePath);
    }
    return entry.isFile() && isTextFile(absolutePath) ? [absolutePath] : [];
  });

const locationAt = (source, index) => {
  const preceding = source.slice(0, index);
  const lines = preceding.split(/\r?\n/);
  return {
    line: lines.length,
    column: (lines.at(-1) || "").length + 1,
  };
};

const collectOccurrences = ({ source, value, label, kind, findings }) => {
  let index = source.indexOf(value);
  while (index !== -1) {
    findings.push({
      ...locationAt(source, index),
      kind,
      label,
      marker: value,
    });
    index = source.indexOf(value, index + value.length);
  }
};

const collectPatternOccurrences = ({ source, expression, label, findings }) => {
  expression.lastIndex = 0;
  let match = expression.exec(source);
  while (match) {
    findings.push({
      ...locationAt(source, match.index),
      kind: "sequence",
      label,
      marker: match[0],
    });
    match = expression.exec(source);
  }
};

const findEncodingDefects = (source = "") => {
  const findings = [];

  collectOccurrences({
    source,
    value: fromCodePoint(0xfffd),
    label: "Unicode replacement character",
    kind: "character",
    findings,
  });

  mojibakePatterns.forEach(({ expression, label }) => {
    collectPatternOccurrences({ source, expression, label, findings });
  });

  corruptHtmlEntities.forEach((value) => {
    collectOccurrences({
      source,
      value,
      label: "corrupted HTML entity",
      kind: "html_entity",
      findings,
    });
  });

  return findings.sort((left, right) => left.line - right.line || left.column - right.column);
};

const auditRepository = ({ root = repositoryRoot } = {}) => {
  const files = listTextFiles(root);
  const findings = files.flatMap((filePath) =>
    findEncodingDefects(fs.readFileSync(filePath, "utf8")).map((finding) => ({
      ...finding,
      file: path.relative(root, filePath).replaceAll("\\", "/"),
    }))
  );

  return { filesScanned: files.length, findings };
};

if (require.main === module) {
  const { filesScanned, findings } = auditRepository();
  if (findings.length) {
    console.error(`Encoding audit found ${findings.length} defect(s):`);
    findings.forEach((finding) => {
      console.error(
        `- ${finding.file}:${finding.line}:${finding.column} ${finding.label}`
      );
    });
    process.exitCode = 1;
  } else {
    console.log(
      `Encoding audit passed: ${filesScanned} UTF-8 text files contain no mojibake or replacement characters.`
    );
  }
}

module.exports = {
  auditRepository,
  findEncodingDefects,
  listTextFiles,
};
