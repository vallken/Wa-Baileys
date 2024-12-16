const afkModel = require("../lib/db/afk");
const config = require('../config');

class AfkManager {
  static async setAfkStatus(userId, reason) {
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
  }

  static async getAfkStatus(userId) {
    try {
      return await afkModel.findOne({ userId });
    } catch (err) {
      console.error("Error getting AFK status:", err);
      return null;
    }
  }

  static async removeAfkStatus(userId) {
    try {
      await afkModel.findOneAndDelete({ userId });
      console.log(`AFK status removed for user ${userId}`);
    } catch (err) {
      console.error("Error removing AFK status:", err);
    }
  }

  static getAfkDuration(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} hari`;
    if (hours > 0) return `${hours} jam`;
    return `${minutes} menit`;
  }

  static processMentions(text) {
    const mentions = [];
    const matches = text.match(/@(\d+)/g) || [];

    for (const match of matches) {
      const number = match.replace('@', '').trim();
      const formattedNumber = `${number}@s.whatsapp.net`;
      mentions.push(formattedNumber);
    }
    return {
      text,
      mentions: mentions.length > 0 ? mentions : null,
    };
  }
}

const execute = async (sock, msg, args) => {
  const userId = msg.key.participant || msg.key.remoteJid;
  const from = msg.key.remoteJid;

  if (args.length === 0) {
    const afkStatus = await AfkManager.getAfkStatus(userId);
    if (afkStatus && afkStatus.afk) {
      await AfkManager.removeAfkStatus(userId);
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
    await AfkManager.setAfkStatus(userId, reason);
    await sock.sendMessage(from, {
      text: `Status AFK Anda telah diatur: ${reason}`,
    });
  }
};

const checkAfkMention = async (sock, msg) => {
  try {
    const mentionedUsers = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quoteAuthor = msg.message?.extendedTextMessage?.contextInfo?.participant;

    const currentSender = msg.key.participant || msg.key.remoteJid;
    const usersToCheck = [...new Set([...mentionedUsers, quoteAuthor].filter(user => user !== msg.key.fromMe))];

    if (usersToCheck.length === 0) return;

    const afkStatuses = await Promise.all(usersToCheck.map(AfkManager.getAfkStatus));
    for (let i = 0; i < usersToCheck.length; i++) {
      const afkStatus = afkStatuses[i];
      if (afkStatus && afkStatus.afk && !msg.key.fromMe) {
        const duration = AfkManager.getAfkDuration(afkStatus.timestamp);
        const reasonProcessed = AfkManager.processMentions(afkStatus.reason);
        const user = usersToCheck[i].replace("@s.whatsapp.net", "");
        const allMentions = [...usersToCheck, ...(reasonProcessed.mentions || [])];

        await sock.sendMessage(msg.key.remoteJid, {
          text: `@${user} sedang AFK (${duration}).\nAlasan: ${reasonProcessed.text}`,
          mentions: allMentions,
        });
      }
    }
  } catch (err) {
    console.error("Error checking AFK mention:", err);
  }
};

const checkAfkMessage = async (sock, msg) => {
  const userId = msg.key.participant || msg.key.remoteJid;

  const afkStatus = await AfkManager.getAfkStatus(userId);

  if (afkStatus && afkStatus.afk) {
    await AfkManager.removeAfkStatus(userId);
    const from = msg.key.remoteJid;
    await sock.sendMessage(from, {
      text: `Selamat datang kembali @${userId.split("@")[0]}`,
      mentions: [userId],
    });
  }
};

module.exports = {
  name: "afk",
  description: "Set AFK status",
  command: `${config.prefix[1]}afk`,
  commandType: "plugin",
  isDependent: false,
  help: `Gunakan ${config.prefix[1]}afk <alasan> untuk mengatur status AFK Anda.`,
  execute,
  checkAfkMention,
  checkAfkMessage,
};
