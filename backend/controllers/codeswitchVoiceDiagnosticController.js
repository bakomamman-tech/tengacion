const {
  getCaptureStatus,
  enableCapture,
  disableCapture,
  listTemporaryTranscripts,
  getTemporaryTranscriptById,
  getLatestTemporaryTranscript,
  deleteTemporaryTranscript,
  clearTemporaryTranscripts,
} = require(
  "../services/voicebridgeTranscriptDiagnosticService"
);

const setNoStore = (res) => {
  res.set("Cache-Control", "no-store");
};

const status = (_req, res) => {
  setNoStore(res);
  return res.json({ ok: true, diagnostics: getCaptureStatus() });
};

const enable = (req, res) => {
  setNoStore(res);
  const diagnostics = enableCapture(req.body?.minutes);
  return res.json({ ok: true, diagnostics });
};

const disable = (_req, res) => {
  setNoStore(res);
  return res.json({ ok: true, diagnostics: disableCapture() });
};

const list = async (req, res) => {
  setNoStore(res);
  const diagnostics = await listTemporaryTranscripts({ limit: req.query?.limit });
  return res.json({
    ok: true,
    diagnostics,
    capture: getCaptureStatus(),
  });
};

const reveal = async (req, res) => {
  setNoStore(res);
  const diagnostic = await getTemporaryTranscriptById(req.params?.id);
  if (!diagnostic) {
    return res.status(404).json({ error: "Temporary VoiceBridge diagnostic not found or expired." });
  }
  return res.json({ ok: true, diagnostic });
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

const remove = async (req, res) => {
  setNoStore(res);
  const result = await deleteTemporaryTranscript(req.params?.id);
  return res.json({ ok: true, ...result });
};

const clear = async (_req, res) => {
  setNoStore(res);
  const diagnostics = disableCapture();
  const result = await clearTemporaryTranscripts();
  return res.json({ ok: true, ...result, diagnostics });
};

module.exports = {
  status,
  enable,
  disable,
  list,
  reveal,
  latest,
  remove,
  clear,
};
