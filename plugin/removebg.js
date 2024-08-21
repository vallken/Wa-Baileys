const FormData = require("form-data");
require("dotenv").config();
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const axios = require("axios");
const mime = require("mime-types");

const api = process.env.REMOVE_URI;
async function removeUrl(imageURL) {
  const formData = new FormData();
  formData.append("size", "auto");
  formData.append("image_url", imageURL);

  const response = await axios.post(
    "https://api.remove.bg/v1.0/removebg",
    formData,
    {
      headers: { "X-Api-Key": api, ...formData.getHeaders() },
      responseType: "arraybuffer",
    }
  );

  if (response.status === 200) {
    return await response.data;
  } else {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
}

async function removeBlob(blob) {
  const formData = new FormData();
  formData.append("size", "auto");
  formData.append("image_file", blob);

  const response = await axios.post(
    "https://api.remove.bg/v1.0/removebg",
    formData,
    {
      headers: { "X-Api-Key": api, ...formData.getHeaders() },
      responseType: "arraybuffer",
    }
  );

  if (response.status === 200) {
    return await response.data;
  } else {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
}

function isValidURL(input) {
  try {
    new URL(input);
    return true;
  } catch (e) {
    return false;
  }
}

const randomString = () => {
  const length = 10;
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const execute = async (sock, msg, args) => {
  if (args.length === 0) {
    return sock.sendMessage(msg.key.remoteJid, {
      text: "Kirim URL / gambar yang ingin dihapus background!",
    });
  } else {
    if (msg.message.imageMessage) {
      try {
        const imageBuffer = await downloadMediaMessage(msg, "buffer", {});
        const buffer = await removeBlob(imageBuffer);
        sock.sendMessage(msg.key.remoteJid, {
          image: buffer,
          mimetype: mime.lookup("png"),
          fileName: `${randomString()}.png`,
        });
        return;
      } catch (error) {
        console.error(error);
        sock.sendMessage(msg.key.remoteJid, {
          text: "Gagal menghapus background.",
        });
        return;
      }
    } else if (isValidURL(args[0])) {
      const imageURL = args[0];
      try {
        const buffer = await removeUrl(imageURL);
        sock.sendMessage(msg.key.remoteJid, {
          image: buffer,
          mimetype: mime.lookup("png"),
          fileName: `${randomString()}.png`,
        });
      } catch (error) {
        console.error(error);
        sock.sendMessage(msg.key.remoteJid, {
          text: "Gagal menghapus background.",
        });
      }
    } else {
      sock.sendMessage(msg.key.remoteJid, {
        text: "URL yang anda kirim salah.",
      });
    }
  }
};

module.exports = {
  name: "RemoveBackground",
  description: "Hapus background gambar",
  command: "removeBackground",
  commandType: "Filter",
  isDependent: false,
  help: "Hapus background gambar yang dikirimkan.",
  execute,
};
