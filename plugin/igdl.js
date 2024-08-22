const igdown = require("../helper/igDown");

const execute = async (sock, msg, args) => {
  if (!args[0]) {
    return sock.sendMessage(msg.key.remoteJid, {
      text: "Masukkan link Instagram yang ingin diunduh!",
    });
  } else {
    try {
      const media = await igdown(args[0]);
      media.data.url.map((media) => {
        if (media.includes("jpg")) {
          sock.sendMessage(msg.key.remoteJid, {
            image: { url: media },
          });
        } else {
          sock.sendMessage(msg.key.remoteJid, {
            video: { url: media },
          });
        }
      });
    } catch (err) {
      console.error(err);
      sock.sendMessage(msg.key.remoteJid, {
        text: "Gagal mengunduh media Instagram!",
      });
    }
  }
};

module.exports = {
  name: "Insagram Downloader",
  description: "Mengunduh media Instagram",
  command: "!igdl",
  commandType: "Downloader",
  isDependent: false,
  help: "Ketik!igdl [link_instagram] untuk mengunduhnya",
  execute,
};
