// Package contracts are populated from the checked-in execution roadmaps.
const established = require("./externalReadinessPackages.json");
const nextFifty = require("./externalReadinessNext50");

module.exports = [
  ...established,
  ...nextFifty,
];
