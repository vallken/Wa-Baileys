const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const path = require("path");
const fs = require("fs").promises;

// Path ke file JSON yang menyimpan daftar AFK
const afkModel = require("../lib/db/afk");

// Fungsi untuk menyimpan status AFK ke JSON
const setAfkStatus = async (userId, reason) => {
  try {
    await afkModel.findOneAndUpdate(
      { userId },
      { reason, afk: true, timestamp: new Date() },
      { upsert: true, new: true }
    );
    console.log(`AFK status set for user ${userId}`);
  } catch (err) {
    console.error("Error setting AFK status:", err);
  }
};

// Fungsi untuk mendapatkan status AFK dari JSON
const getAfkStatus = async (userId) => {
  try {
    return await afkModel.findOne({ userId: userId });
  } catch (err) {
    if (err.code === "ENOENT") return null;
    console.error("Error getting AFK status:", err);
    return null;
  }
};

// Fungsi untuk menghapus status AFK dari JSON
const removeAfkStatus = async (userId) => {
  try {
    afkModel.findOneAndDelete({ userId: userId });
    console.log(`AFK status removed for user ${userId}`);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Error removing AFK status:", err);
    }
  }
};

// Fungsi untuk menghitung durasi AFK
const getAfkDuration = (timestamp) => {
  const now = new Date();
  const diff = now - new Date(timestamp);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} hari`;
  if (hours > 0) return `${hours} jam`;
  return `${minutes} menit`;
};

// Fungsi utama untuk menangani perintah AFK
const execute = async (sock, msg, args) => {
  const userId = msg.key.participant ? msg.key.participant : msg.key.remoteJid;
  const from = msg.key.remoteJid;

  if (args.length === 0) {
    // Jika tidak ada argumen, cek apakah pengguna sedang AFK
    const afkStatus = await getAfkStatus(userId);
    if (afkStatus) {
      await removeAfkStatus(userId);
      await sock.sendMessage(from, {
        text: `Anda sudah tidak AFK lagi. Selamat datang kembali!`,
      });
    } else {
      await sock.sendMessage(from, {
        text: `Gunakan .afk <alasan> untuk mengatur status AFK Anda.`,
      });
    }
  } else {
    // Set status AFK
    const reason = args.join(" ");
    await setAfkStatus(userId, reason);
    await sock.sendMessage(from, {
      text: `Status AFK Anda telah diatur: ${reason}`,
    });
  }
};

const checkAfkMention = async (sock, msg) => {
  try {
    const mentionedUser = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;

    if (!Array.isArray(mentionedUser) || mentionedUser.length === 0) {
      return; // Tidak ada user yang di-mention, keluar dari fungsi
    }

    let promises = [];
    let quoteAuthor = msg.message?.extendedTextMessage?.contextInfo?.participant;

    // Jika pesan mengutip pesan lain, cek AFK dari pengutip
    if (quoteAuthor && !msg.key.fromMe) {
      promises.push(getAfkStatus(quoteAuthor));
    }

    // Loop untuk memeriksa semua user yang di-mention
    for (const mention of mentionedUser) {
      promises.push(getAfkStatus(mention));
    }    
    // Tunggu semua promises selesai    
    const afkStatuses = await Promise.all(promises);
    let mentions = quoteAuthor ? quoteAuthor : mentionedUser.join('');
    
    

    // Tampilkan pesan AFK untuk setiap status yang ditemukan
    for (let i = 0; i < afkStatuses.length; i++) {
      if (afkStatuses[i]) {
        const afkStatus = afkStatuses[i];
        const duration = getAfkDuration(afkStatus.timestamp);
        let user = quoteAuthor ? quoteAuthor : mentionedUser;

        if (user && typeof user === "string") {
          user = user.replace("@s.whatsapp.net", "");
          await sock.sendMessage(msg.key.remoteJid, {
            text: `@${user} sedang AFK (${duration}).\nAlasan: ${afkStatus.reason}`,
            mentions: [mentions],
          });
        }
      }
    }
  } catch (err) {
    console.error("Error checking AFK mention:", err);
  }
};



module.exports = {
  name: "afk",
  description: "Set AFK status",
  command: ".afk",
  commandType: "plugin",
  isDependent: false,
  help: "Gunakan .afk <alasan> untuk mengatur status AFK Anda.",
  execute,
  checkAfkMention, // Ekspos fungsi ini untuk digunakan di event handler utama
};
