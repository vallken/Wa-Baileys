const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  userId: String,
  score: { type: Number, default: 0 },
});

const QuizScore = mongoose.model("QuizScore", quizSchema);
module.exports = QuizScore;