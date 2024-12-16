const mongoose = require("mongoose");

const pluginSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  isMaintenance: {
    type: Boolean,
    required: true,
    default: false, 
  },
});

const Plugin = mongoose.model("maintenance", pluginSchema);
module.exports = Plugin;
