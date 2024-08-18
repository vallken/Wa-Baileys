const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require("path");
const fs = require("fs").promises;

// Path ke file JSON yang menyimpan daftar AFK
const afkPath = path.resolve(__dirname, "afkList.json");

// Fungsi untuk menyimpan status AFK ke JSON
const setAfkStatus = async (userId, reason) => {
  try {
    // Baca file JSON
    let afkList = [];

    try {
      const data = await fs.readFile(afkPath, "utf8");
      afkList = JSON.parse(data);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    // Tambah status AFK ke array
    afkList.push({ userId: userId, reason: reason, timestamp: new Date() });

    // Simpan array yang telah diupdate kembali ke file JSON
    await fs.writeFile(afkPath, JSON.stringify(afkList, null, 2));

    console.log(`AFK status set for user ${userId}`);
  } catch (err) {
    console.error("Error setting AFK status:", err);
  }
};

// Fungsi untuk mendapatkan status AFK dari JSON
const getAfkStatus = async (userId) => {
  try {
    const data = await fs.readFile(afkPath, "utf8");
    const afkList = JSON.parse(data);
    return afkList.find((item) => item.userId === userId) || null;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    console.error("Error getting AFK status:", err);
    return null;
  }
};

// Fungsi untuk menghapus status AFK dari JSON
const removeAfkStatus = async (userId) => {
  try {
    const data = await fs.readFile(afkPath, "utf8");
    let afkList = JSON.parse(data);

    // Filter keluar status AFK yang sesuai dengan userId
    afkList = afkList.filter((item) => item.userId !== userId);

    // Simpan kembali array yang telah difilter ke file JSON
    await fs.writeFile(afkPath, JSON.stringify(afkList, null, 2));

    console.log(`AFK status removed for user ${userId}`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
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
  const userId = msg.key.remoteJid;

  if (args.length === 0) {
    // Jika tidak ada argumen, cek apakah pengguna sedang AFK
    const afkStatus = await getAfkStatus(userId);
    if (afkStatus) {
      await removeAfkStatus(userId);
      await sock.sendMessage(userId, {
        text: `Anda sudah tidak AFK lagi. Selamat datang kembali!`,
      });
    } else {
      await sock.sendMessage(userId, {
        text: `Gunakan .afk <alasan> untuk mengatur status AFK Anda.`,
      });
    }
  } else {
    // Set status AFK
    const reason = args.join(" ");
    await setAfkStatus(userId, reason);
    await sock.sendMessage(userId, {
      text: `Status AFK Anda telah diatur: ${reason}`,
    });
  }
};

// Fungsi untuk memeriksa dan merespons mention ke pengguna AFK
const checkAfkMention = async (sock, msg) => {
  try {
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let promises = [];
    let quoteAuthor = null;
    let usersMap = {}; // Menyimpan peta antara ID pengguna dan nama

    // Jika pesan mengutip pesan lain, cek AFK dari pengutip
    if (msg.message?.extendedTextMessage?.contextInfo?.participant && !msg.key.fromMe) {
      quoteAuthor = msg.message.extendedTextMessage.contextInfo.participant;
      promises.push(getAfkStatus(quoteAuthor));

      // Ambil info pengguna yang mengutip pesan
      try {
        const [quoteContact] = await sock.onWhatsApp(quoteAuthor);
        if (quoteContact.exists) {
          usersMap[quoteAuthor] = quoteContact.pushname || quoteAuthor.split('@')[0];
        } else {
          usersMap[quoteAuthor] = quoteAuthor.split('@')[0];
        }
      } catch (error) {
        console.error("Error getting quote author contact info:", error);
        usersMap[quoteAuthor] = quoteAuthor.split('@')[0];
      }
    }

    // Loop untuk memeriksa semua user yang di-mention
    for (const mentionedJid of mentionedJids) {
      promises.push(getAfkStatus(mentionedJid));

      // Ambil info pengguna yang disebutkan
      try {
        const [mentionedContact] = await sock.onWhatsApp(mentionedJid);
        if (mentionedContact.exists) {
          usersMap[mentionedJid] = mentionedContact.pushname || mentionedJid.split('@')[0];
        } else {
          usersMap[mentionedJid] = mentionedJid.split('@')[0];
        }
      } catch (error) {
        console.error("Error getting mentioned contact info:", error);
        usersMap[mentionedJid] = mentionedJid.split('@')[0];
      }
    }

    // Tunggu semua promises selesai
    const afkStatuses = await Promise.all(promises);

    // Tampilkan pesan AFK untuk setiap status yang ditemukan
    for (let i = 0; i < afkStatuses.length; i++) {
      if (afkStatuses[i]) {
        const afkStatus = afkStatuses[i];
        const duration = getAfkDuration(afkStatus.timestamp);
        const user = i === 0 && quoteAuthor ? usersMap[quoteAuthor] : usersMap[mentionedJids[i - (quoteAuthor ? 1 : 0)]];

        await sock.sendMessage(msg.key.remoteJid, {
          text: `${user} sedang AFK (${duration}).\nAlasan: ${afkStatus.reason}`,
        });
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