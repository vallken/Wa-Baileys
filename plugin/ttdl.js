const TiktokInfo = require('../helper/musicalDown')

function isValidURL(input) {
  try {
    new URL(input);
    return true;
  } catch (e) {
    return false;
  }
}

const execute = async (sock, msg, args) => {
  if (!args[0]) {
    return sock.sendMessage(msg.key.remoteJid, {
      text: "Masukkan URL TikTok yang ingin diunduh!",
    });
  } else if (isValidURL(args[0])) {
    const response = await TiktokInfo.MusicalDown(args[0]);
    sock.sendMessage(msg.key.remoteJid, { text: "Sedang Diproses.." });
    if (response.status === "success") {
      if (response.result.type === "image") {
        sock.sendMessage(msg.key.remoteJid, {
          image: { url: response.result.author.nickname },
          url: response.images[0],
        });
      } else {
        sock.sendMessage(msg.key.remoteJid, {
          video: { url: response.result.video1 },
          caption: response.result.desc,
          quoted: msg
        });
      }
    } else {
      sock.sendMessage(msg.key.remoteJid, { text: response.message });
    }
  } else {
    sock.sendMessage(msg.key.remoteJid, { text: "Masukkan URL!" });
    s;
  }
};

module.exports = {
  name: "Tiktok Downloader",
  description: "Mendownload video dan gambar TikTok",
  command: "!ttdl <url>",
  commandType: "Downloader",
  isDependent: false,
  help: "Mendownload video dan gambar dari tiktok.",
  execute,
};
