const mongoose = require("mongoose");

const todoSchema = mongoose.Schema(
  {
    userId: { type: String, required: true },
    task: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "todo" }
);


module.exports = mongoose.model("todo", todoSchema);
