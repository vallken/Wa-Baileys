const afkModel = require("../lib/db/afk");
const config = require('../config'); // Import konfigurasi prefix


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

const getAfkStatus = async (userId) => {
  try {
    return await afkModel.findOne({ userId });
  } catch (err) {
    console.error("Error getting AFK status:", err);
    return null;
  }
};

const removeAfkStatus = async (userId) => {
  try {
    await afkModel.findOneAndDelete({ userId });
    console.log(`AFK status removed for user ${userId}`);
  } catch (err) {
    console.error("Error removing AFK status:", err);
  }
};

const getAfkDuration = (timestamp) => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} hari`;
  if (hours > 0) return `${hours} jam`;
  return `${minutes} menit`;
};

const execute = async (sock, msg, args) => {
  const userId = msg.key.participant || msg.key.remoteJid;
  const from = msg.key.remoteJid;

  if (args.length === 0) {
    const afkStatus = await getAfkStatus(userId);
    if (afkStatus && afkStatus.afk) {
      await removeAfkStatus(userId);
      await sock.sendMessage(from, {
        text: `Anda sudah tidak AFK lagi. Selamat datang kembali!`,
      });
    } else {
      await sock.sendMessage(from, {
        text: `Gunakan ${config.prefix[1]}afk <alasan> untuk mengatur status AFK Anda.`,
      });
    }
  } else {
    const reason = args.join(" ");
    await setAfkStatus(userId, reason);
    await sock.sendMessage(from, {
      text: `Status AFK Anda telah diatur: ${reason}`,
    });
  }
};

const checkAfkMention = async (sock, msg) => {
  try {
    const mentionedUsers =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quoteAuthor =
      msg.message?.extendedTextMessage?.contextInfo?.participant;

    // Hindari memeriksa pengirim pesan saat ini
    const currentSender = msg.key.participant || msg.key.remoteJid;

    // Filter out currentSender dan hapus duplikat
    const usersToCheck = [
      ...new Set(
        [...mentionedUsers, quoteAuthor].filter(
          (user) => user !== msg.key.fromMe
        )
      ),
    ];

    if (usersToCheck.length === 0) return;

    const afkStatuses = await Promise.all(usersToCheck.map(getAfkStatus));

    for (let i = 0; i < usersToCheck.length; i++) {
      const afkStatus = afkStatuses[i];
      if (afkStatus && afkStatus.afk && !msg.key.fromMe) {
        const duration = getAfkDuration(afkStatus.timestamp);
        const user = usersToCheck[i].replace("@s.whatsapp.net", "");
        await sock.sendMessage(msg.key.remoteJid, {
          text: `@${user} sedang AFK (${duration}).\nAlasan: ${afkStatus.reason}`,
          mentions: [usersToCheck[i]],
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
  command: `${config.prefix[1]}afk`,
  commandType: "plugin",
  isDependent: false,
  help: "Gunakan !afk <alasan> untuk mengatur status AFK Anda.",
  execute,
  checkAfkMention,
};
