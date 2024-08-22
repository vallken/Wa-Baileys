const igdown = require("../helper/igDown");
const axios = require("axios");

async function getFileInfo(url) {
  try {
    const response = await axios.head(url);

    const contentDisposition = response.headers["content-disposition"];
    const contentType = response.headers["content-type"];

    let fileName;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match && match[1]) {
        fileName = match[1];
      }
    }

    if (!fileName) {
      const ext = contentType ? `.${contentType.split("/")[1]}` : "";
      fileName = `downloaded_file${ext}`;
    }

    return { fileName, contentType };
  } catch (error) {
    console.error("Failed to get file info:", error.message);
  }
}

const execute = async (sock, msg, args) => {
  if (!args[0]) {
    return sock.sendMessage(msg.key.remoteJid, {
      text: "Masukkan link Instagram yang ingin diunduh!",
    });
  } else {
    try {
      const media = await igdown(args[0]);
      const processedUrls = new Set();

      for (const item of media.data) {
        if (!processedUrls.has(item.url)) {
          const cekFile = await getFileInfo(item.url);

          processedUrls.add(item.url);
          // Uncomment this part when ready to send messages
          if (cekFile.fileName.endsWith(".mp4")) {
            await sock.sendMessage(msg.key.remoteJid, {
              video: { url: item.url },
              caption: cekFile.fileName,
            });
          } else {
            await sock.sendMessage(msg.key.remoteJid, {
              image: { url: item.url },
            });
          }
        }
      }
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
