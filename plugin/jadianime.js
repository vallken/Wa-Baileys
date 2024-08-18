const formData = require("form-data");
const axios = require("axios");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
function isValidURL(input) {
  try {
    new URL(input);
    return true;
  } catch (e) {
    return false;
  }
}

const execute = async (sock, msg, args) => {
  const url = "https://tools.betabotz.eu.org";
  if (!args)
    return sock.sendMessage(msg.key.remoteJid, {
      text: "Masukkan link gambar yang akan di-edit.",
    });
  else if (msg.message.imageMessage || msg.message.documentMessage) {
    const buffer = await downloadMediaMessage(msg, "buffer", {});

    const form = new formData();
    form.append("image", buffer, "image.jpg");
    const response = await axios.post(`${url}/ai/toanime`, form, {
      headers: form.getHeaders(),
    });
    if (response.status === 200) {
      sock.sendMessage(msg.key.remoteJid, {
        image: { url: response.data.result },
      });
    } else {
      sock.sendMessage(msg.key.remoteJid, {
        text: "Terjadi Kesalahan Saat Memproses Data",
      });
    }
  } else if (isValidURL(args[0])) {
    const response = await axios.get(args[0], { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data);
    const form = new formData();
    form.append("image", buffer, "image.jpg");
    const res = await axios.post(`${url}/ai/toanime`, form, {
      headers: form.getHeaders(),
    });
    if (res.status === 200) {
      sock.sendMessage(msg.key.remoteJid, {
        image: { url: res.data.result },
      });
    } else {
      sock.sendMessage(msg.key.remoteJid, {
        text: "Terjadi Kesalahan Saat Memproses Data",
      });
    }
  } else {
    sock.sendMessage(msg.key.remoteJid, {
      text: "Masukkan link / upload gambar yang akan di-edit.",
    });
  }
};

module.exports = {
    name: "AI Anime",
    description: "Mengubah gambar ke menjadi Anime",
    command: "!jadianime",
    commandType: "plugin",
    isDependent: false,
    help: "Kirimkan Gambar / link untuk menjadi anime",
    execute,
  
};