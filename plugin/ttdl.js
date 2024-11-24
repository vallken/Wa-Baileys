const TiktokInfo = require("../helper/musicalDown");
const config = require('../config'); 


function isValidURL(input) {
  try {
    new URL(input);
    return true;
  } catch (e) {
    return false;
  }
}

const execute = async (sock, msg, args) => {
  try {
    if (!args[0]) {
      return sock.sendMessage(msg.key.remoteJid, {
        text: `Masukkan URL TikTok yang ingin diunduh! contoh ${config.prefix[1]}ttdl <link>`,
      });
    } else if (isValidURL(args[0])) {
      const response = await TiktokInfo.MusicalDown(args[0]);
      sock.sendMessage(msg.key.remoteJid, { text: "Sedang Diproses.." });
      if (response.status === "success") {
        if (response.result.type === "image") {
          response.result.images.map((imageUrl) => {
            sock.sendMessage(msg.key.remoteJid, {
              image: { url: imageUrl },
            });
          });
        } else {
          sock.sendMessage(msg.key.remoteJid, {
            video: { url: response.result.video1 },
            quoted: msg,
          });
        }
      } else {
        sock.sendMessage(msg.key.remoteJid, { text: response.message });
      }
    } else {
      sock.sendMessage(msg.key.remoteJid, { text: "Masukkan URL!" });
      s;
    }
  } catch (e) {
    console.log(e);
    sock.sendMessage(msg.key.remoteJid, { text: "Terjadi kesalahan." });
  }
};

module.exports = {
  name: "Tiktok Downloader",
  description: "Mendownload video dan gambar TikTok",
  command: `${config.prefix[1]}ttdl`,
  commandType: "Downloader",
  isDependent: false,
  help: "Mendownload video dan gambar dari tiktok.",
  execute,
};
