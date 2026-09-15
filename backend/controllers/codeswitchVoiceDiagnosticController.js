const {
  getCaptureStatus,
  enableCapture,
  disableCapture,
  getLatestTemporaryTranscript,
  clearTemporaryTranscripts,
} = require(
  "../services/voicebridgeTranscriptDiagnosticService"
);

const setNoStore = (res) => {
  res.set("Cache-Control", "no-store");
};

const status = (_req, res) => {
  setNoStore(res);
  return res.json({
    ok: true,
    diagnostics: getCaptureStatus(),
  });
};

const enable = (req, res) => {
  setNoStore(res);
  const diagnostics = enableCapture(req.body?.minutes);
  return res.json({
    ok: true,
    diagnostics,
  });
};

const disable = (_req, res) => {
  setNoStore(res);
  return res.json({
    ok: true,
    diagnostics: disableCapture(),
  });
};

const latest = async (_req, res) => {
  setNoStore(res);
  const diagnostic = await getLatestTemporaryTranscript();
  return res.json({
    ok: true,
    available: Boolean(diagnostic),
    diagnostics: getCaptureStatus(),
    diagnostic,
  });
};

const clear = async (_req, res) => {
  setNoStore(res);
  const result = await clearTemporaryTranscripts();
  return res.json({
    ok: true,
    ...result,
  });
};

module.exports = {
  status,
  enable,
  disable,
  latest,
  clear,
};
