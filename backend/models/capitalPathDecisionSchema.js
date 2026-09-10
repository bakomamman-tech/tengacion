const mongoose = require("mongoose");

const {
  pathKeys,
  packetSectionKeys,
} = require("../config/capitalPaths");

const text = (max = 2000) => ({
  type: String,
  trim: true,
  maxlength: max,
  default: "",
});

const evidenceIndexes = () => [
  {
    type: Number,
    min: 0,
    validate: Number.isInteger,
  },
];

const packetSectionSchema =
  new mongoose.Schema(
    {
      key: {
        type: String,
        enum: packetSectionKeys,
        required: true,
      },

      evidenceIndexes:
        evidenceIndexes(),
    },
    {
      _id: false,
    }
  );

module.exports =
  new mongoose.Schema(
    {
      /*
       * CAPITAL-011 drafts are
       * intentionally allowed to
       * remain incomplete.
       *
       * The deterministic analyzer,
       * not this schema, decides when
       * the record is complete enough
       * for independent review.
       */
      path: {
        type: String,
        enum: pathKeys,
      },

      rationale: text(4000),

      /*
       * Human-readable execution
       * timeline for the chosen path.
       * The record owner remains the
       * canonical accountable owner.
       */
      timeline: text(2000),

      evidenceRequirements: [
        {
          type: String,
          trim: true,
          maxlength: 1000,
        },
      ],

      packetSections: [
        packetSectionSchema,
      ],
    },
    {
      _id: false,
    }
  );