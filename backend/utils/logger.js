const log = (level, message, meta = {}) => {
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  console[level === "error" ? "error" : "log"](JSON.stringify(entry));
};

module.exports = {
  info: (msg, meta) => log("info", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
  error: (msg, meta) => log("error", msg, meta),
};
