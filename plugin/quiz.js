const config = require("../config");
const QuizScore = require("../lib/db/quizScore");
const User = require("../lib/db/userLb");
const Soal = require("../lib/db/soal");

class QuizManager {
  constructor() {
    this.activeQuizzes = new Map();
    this.config = {
      questionDuration: 60000,
      hintTime: 30000,
      scorePerCorrectAnswer: 10,
    };
  }

  async fetchQuestion() {
    try {
      const unusedCount = await Soal.countDocuments({ isUsed: false });
      if (unusedCount === 0) {
        await Soal.updateMany({}, { $set: { isUsed: false } });
      }

      const result = await Soal.aggregate([
        { $match: { isUsed: false } },
        { $sample: { size: 1 } },
      ]);

      if (result.length === 0) {
        console.error("No questions found in the database.");
        return null;
      }

      const questionData = result[0];
      await Soal.updateOne(
        { _id: questionData._id },
        { $set: { isUsed: true } }
      );

      return {
        question: questionData.soal,
        answer: this.normalizeAnswer(questionData.jawaban),
      };
    } catch (error) {
      console.error("Error fetching question:", error.message);
      return null;
    }
  }

  normalizeAnswer(answer) {
    return answer.toLowerCase().trim();
  }

  generateHint(answer) {
    const answerChars = answer.split("");
    const hintChars = answerChars.map(() => "_");
    const revealCount = Math.max(1, Math.ceil(answerChars.length / 3));

    const revealedIndexes = new Set();
    while (revealedIndexes.size < revealCount) {
      const randomIndex = Math.floor(Math.random() * answerChars.length);
      revealedIndexes.add(randomIndex);
    }

    revealedIndexes.forEach((index) => {
      hintChars[index] = answerChars[index];
    });

    return hintChars.join("");
  }

  async startQuiz(sock, from) {
    if (this.activeQuizzes.has(from)) {
      await sock.sendMessage(from, {
        text: "Masih ada kuis yang berlangsung!",
      });
      return;
    }

    const quiz = await this.fetchQuestion();
    if (!quiz) {
      await sock.sendMessage(from, {
        text: "Tidak dapat memuat pertanyaan. Coba lagi nanti.",
      });
      return;
    }

    const quizData = {
      ...quiz,
      startTime: Date.now(),
      hintGiven: false,
      participants: new Set(),
    };

    this.activeQuizzes.set(from, quizData);
    await sock.sendMessage(from, {
      text: `📝 Pertanyaan: ${quiz.question}\n\n⏳ Anda punya waktu 1 menit untuk menjawab!`,
    });

    this.setupQuizTimer(sock, from);
  }

  setupQuizTimer(sock, from) {
    const checkInterval = setInterval(async () => {
      const quiz = this.activeQuizzes.get(from);

      if (!quiz) {
        clearInterval(checkInterval);
        return;
      }

      const elapsedTime = Date.now() - quiz.startTime;

      if (!quiz.hintGiven && elapsedTime >= this.config.hintTime) {
        quiz.hintGiven = true;
        const hint = this.generateHint(quiz.answer);
        await sock.sendMessage(from, {
          text: `💡 Hint: ${hint}`,
        });
      }

      if (elapsedTime >= this.config.questionDuration) {
        clearInterval(checkInterval);
        await sock.sendMessage(from, {
          text: `⏰ Waktu habis! Jawaban yang benar adalah: *${quiz.answer}*`,
        });
        this.activeQuizzes.delete(from);
      }
    }, 1000);
  }

  async handleAnswer(sock, msg) {
    const from = msg.key.remoteJid;
    const userId = msg.key.participant || msg.key.remoteJid;

    const activeQuiz = this.activeQuizzes.get(from);
    if (!activeQuiz) return;

    const userAnswer = (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      ""
    )
      .toLowerCase()
      .trim();

    const user = await User.findOne({ userId });
    if (!user) {
      await sock.sendMessage(
        from,
        {
          text: `❌ Anda belum terdaftar. Gunakan perintah "${config.prefix[1]}quiz register <username>" untuk mendaftar.`,
        },
        { quoted: msg }
      );
      return;
    }

    if (userAnswer === activeQuiz.answer) {
      await QuizScore.findOneAndUpdate(
        { userId },
        { $inc: { score: this.config.scorePerCorrectAnswer } },
        { upsert: true, new: true }
      );

      await sock.sendMessage(
        from,
        {
          text: `🎉 Benar! Jawabannya adalah: ${activeQuiz.answer}\n+${this.config.scorePerCorrectAnswer} Poin untuk ${user.username}!`,
        },
        { quoted: msg }
      );

      this.activeQuizzes.delete(from);
      await this.startQuiz(sock, from);
    } else {
      await sock.sendMessage(from, {
        react: {
          text: "❌",
          key: msg.key,
        },
      });
    }
  }

  async passQuestion(sock, from) {
    const activeQuiz = this.activeQuizzes.get(from);

    if (!activeQuiz) {
      await sock.sendMessage(from, {
        text: "❌ Tidak ada kuis yang sedang berlangsung.",
      });
      return;
    }

    await sock.sendMessage(from, {
      text: `🔍 Jawaban untuk pertanyaan ini adalah: *${activeQuiz.answer}*`,
    });

    this.activeQuizzes.delete(from);
    await this.startQuiz(sock, from);
  }
  async stopQuiz(sock, from) {
    if (!this.activeQuizzes.has(from)) {
      await sock.sendMessage(from, {
        text: "❌ Tidak ada kuis yang sedang berlangsung.",
      });
      return;
    }

    this.activeQuizzes.delete(from);
    await sock.sendMessage(from, {
      text: "⏹️ Kuis telah dihentikan.",
    });
  }

  async showLeaderboard(sock, from, msg) {
    const topScores = await QuizScore.find({})
      .sort({ score: -1 })
      .limit(5)
      .lean();

    if (topScores.length === 0) {
      await sock.sendMessage(from, { text: "Leaderboard kosong." });
      return;
    }

    const leaderboardData = await Promise.all(
      topScores.map(async (entry) => {
        const user = await User.findOne({ userId: entry.userId });
        return {
          username: user?.username || "Unknown",
          score: entry.score,
        };
      })
    );

    let leaderboard = "🏆 *Leaderboard SDM Tinggi* 🏆\n";
    leaderboardData.forEach((entry, index) => {
      leaderboard += `${index + 1}. ${entry.username} - ${entry.score} Poin\n`;
    });

    await sock.sendMessage(from, { text: leaderboard }, { quoted: msg });
  }

  async registerUser(sock, from, userId, username) {
    try {
      const user = await User.findOneAndUpdate(
        { userId },
        { username },
        { upsert: true, new: true }
      );

      await sock.sendMessage(from, {
        text: `✅ Berhasil mendaftarkan username: *${user.username}*. Anda sekarang dapat menjawab kuis.`,
      });
    } catch (error) {
      await sock.sendMessage(from, {
        text: "❌ Terjadi kesalahan saat mendaftarkan username.",
      });
    }
  }

  async setUsername(sock, msg, from, userId, newUsername) {
    try {
      const user = await User.findOneAndUpdate(
        { userId },
        { username: newUsername },
        { new: true }
      );

      if (!user) {
        await sock.sendMessage(
          from,
          {
            text: `❌ Anda belum terdaftar. Gunakan perintah "${config.prefix[1]}quiz register <username>" untuk mendaftar.`,
          },
          { quoted: msg }
        );
        return;
      }

      await sock.sendMessage(from, {
        text: `✅ Username Anda telah diubah menjadi: *${user.username}*`,
      });
    } catch (error) {
      await sock.sendMessage(from, {
        text: "❌ Terjadi kesalahan saat mengganti username.",
      });
    }
  }
}

const quizManager = new QuizManager();

const execute = async (sock, msg, args) => {
  const from = msg.key.remoteJid;
  const userId = msg.key.participant || msg.key.remoteJid;

  switch (args[0]) {
    case "start":
      await quizManager.startQuiz(sock, from);
      break;

    case "leaderboard":
      await quizManager.showLeaderboard(sock, from, msg);
      break;

    case "register":
      const username = args.slice(1).join(" ");
      if (!username) {
        await sock.sendMessage(from, {
          text: `Gunakan: "${config.prefix[1]}quiz register <username>"`,
        });
        return;
      }
      await quizManager.registerUser(sock, from, userId, username);
      break;

    case "setusername":
      const newUsername = args.slice(1).join(" ");
      if (!newUsername) {
        await sock.sendMessage(from, {
          text: `Gunakan: "${config.prefix[1]}quiz setusername <username_baru>"`,
        });
        return;
      }
      await quizManager.setUsername(sock, msg, from, userId, newUsername);
      break;

    case "pass":
      await quizManager.passQuestion(sock, from);
      break;

    case "stop":
      await quizManager.stopQuiz(sock, from);
      break;

    default:
      await sock.sendMessage(from, {
        text:
          `Gunakan:\n` +
          `- ${config.prefix[1]}quiz start untuk memulai kuis\n` +
          `- ${config.prefix[1]}quiz register <username> untuk mendaftar\n` +
          `- ${config.prefix[1]}quiz setusername <username_baru> untuk mengganti username\n` +
          `- ${config.prefix[1]}quiz leaderboard untuk melihat skor.`,
      });
  }
};

const handleMessage = async (sock, msg) => {
  await quizManager.handleAnswer(sock, msg);
};

module.exports = {
  name: "quiz",
  description: "Quiz Pengetahuan Umum",
  command: `${config.prefix[1]}quiz`,
  commandType: "plugin",
  isDependent: false,
  help: `Ketik ${config.prefix[1]}quiz start untuk memulai kuis, jawab langsung di chat, dan lihat skor dengan ${config.prefix[1]}quiz leaderboard.`,
  execute,
  handleMessage,
};
