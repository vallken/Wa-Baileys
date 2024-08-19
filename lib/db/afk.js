const mongoose = require("mongoose");

const afkSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    afk: { type: Boolean, default: false },
    reason: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
  },
  { collection: "afk" }
);

const afkList = mongoose.model('afk', afkSchema)

module.exports = afkList;