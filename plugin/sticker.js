const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { Sticker } = require("wa-sticker-formatter");
const Jimp = require("jimp");
const config = require("../config");

async function convertGifToWebp(gifBuffer) {
  try {
    const image = await Jimp.read(gifBuffer);
    return await image.getBufferAsync(Jimp.MIME_WEBP);
  } catch (error) {
    console.error("Error converting GIF to WebP:", error);
    throw error;
  }
}

const execute = async (sock, msg, args) => {
  try {
    const message = msg.message;
    const quoted = message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const mediaMessage =
      message.imageMessage ||
      message.documentMessage ||
      message.videoMessage || 
      quoted?.imageMessage ||
      quoted?.documentMessage ||
      quoted?.videoMessage;
    if (!mediaMessage) {
      return await sock.sendMessage(msg.key.remoteJid, {
        text: "Kirimkan Gambar, Video, atau kutip GIF untuk dibuatkan stiker.",
      });
    }

    const buffer = await downloadMediaMessage(
      quoted ? { message: quoted } : msg,
      "buffer",
      {}
    );

    if (mediaMessage.mimetype === "image/gif") {
      const webpBuffer = await convertGifToWebp(buffer);
      await sock.sendMessage(msg.key.remoteJid, { sticker: webpBuffer });
    } else {
      const sticker = new Sticker(buffer, {
        pack: "Tusbol Mii",
        author: "Rijal",
      });
      const stickerBuffer = await sticker.toBuffer();

      await sock.sendMessage(msg.key.remoteJid, { sticker: stickerBuffer });
    }
  } catch (error) {
    console.error("Error creating sticker:", error);
    await sock.sendMessage(msg.key.remoteJid, {
      text: "Terjadi kesalahan saat membuat stiker. Pastikan media valid.",
    });
  }
};

module.exports = {
  name: "Create Sticker",
  description: "Create Sticker from Image, Video, or GIF",
  command: `${config.prefix[1]}sticker`,
  commandType: "Utility",
  isDependent: false,
  help: `Kirimkan Gambar, Video, atau GIF untuk Membuat Sticker.\n\nJika ingin menggunakan gambar yang dikutip:\nKutip gambar lalu kirim perintah *${config.prefix[1]}sticker*`,
  execute,
};
