const ApiError = require("../utils/ApiError");

const notImplemented = (label) => {
  throw ApiError.serviceUnavailable(`${label} is not implemented yet`);
};

exports.createTrack = async () => notImplemented("Track upload");
exports.previewTrack = async () => notImplemented("Track preview");
exports.streamTrack = async () => notImplemented("Track stream");
