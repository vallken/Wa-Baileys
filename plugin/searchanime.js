const axios = require("axios");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

function convertToTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

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
    if (msg.message.imageMessage || msg.message.documentMessage) {
      const buffer = await downloadMediaMessage(msg, "buffer", {});
      const request = await axios({
        method: "POST",
        url: "https://api.trace.moe/search",
        data: buffer,
        headers: { "Content-type": "image/jpeg" },
      });

      const response = request.data;
      if (request.status === 200) {
        const result = response.result[0];
        const data = `
${result.filename}
Episode ${result.episode}
${convertToTime(result.from)}-${convertToTime(result.to)}
${(result.similarity * 100).toFixed(2)}% Similarity
`;
        await sock.sendMessage(msg.key.remoteJid, {
          video: { url: result.video },
          caption: data,
        });
      }
    } else {
      if (args.length > 0 && isValidURL(args[0])) {
        const request = await axios.get(
          `https://api.trace.moe/search?url=${encodeURIComponent(args[0])}`
        );
        const response = request.data;
        if (request.status === 200) {
          const result = response.result[0];
          const data = `
${result.filename}
Episode ${result.episode}
${convertToTime(result.from)}-${convertToTime(result.to)}
${(result.similarity * 100).toFixed(2)}% Similarity
`;
          await sock.sendMessage(msg.key.remoteJid, {
            video: { url: result.video },
            caption: data,
          });
        }
      } else if (args.length === 0) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: "Masukkan URL atau Gambar yang Valid",
        });
      } else {
        await sock.sendMessage(msg.key.remoteJid, {
          text: "Masukkan URL yang Valid",
        });
      }
    }
  } catch (e) {
    console.log(e);
    await sock.sendMessage(msg.key.remoteJid, {
      text: "Terjadi Kesalahan Saat Memproses Data",
    });
  }
};

module.exports = {
  name: "Search Anime",
  description: "Search Anime Scene",
  command: ".searchanime",
  commandType: "plugin",
  isDependent: false,
  help: "Kirimkan Gambar Scene Anime / Gunakan .searchanime <url> untuk mencari scene anime",
  execute,
};
