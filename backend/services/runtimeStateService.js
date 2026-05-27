let draining = false;
let drainingReason = "";
let drainingSince = null;

const setDraining = ({ reason = "shutdown", since = new Date() } = {}) => {
  draining = true;
  drainingReason = String(reason || "shutdown").trim() || "shutdown";
  drainingSince = since instanceof Date ? since : new Date(since || Date.now());
  return getRuntimeState();
};

const clearDraining = () => {
  draining = false;
  drainingReason = "";
  drainingSince = null;
  return getRuntimeState();
};

const getRuntimeState = () => ({
  draining,
  drainingReason,
  drainingSince: drainingSince ? drainingSince.toISOString() : "",
});

module.exports = {
  clearDraining,
  getRuntimeState,
  setDraining,
};
