const igdown = require("../helper/igDown");
const axios = require("axios");
const path = require('path');
const mime = require('mime-types');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const config = require('../config'); // Import konfigurasi prefix


async function getFileInfo(url) {
  try {
    const response = await axios.head(url);
    const contentDisposition = response.headers["content-disposition"];
    let contentType = response.headers["content-type"] || 'application/octet-stream';

    let fileName = '';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
      if (filenameMatch) {
        fileName = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    if (!fileName) {
      const urlObj = new URL(url);
      fileName = path.basename(urlObj.pathname) || `file_${crypto.randomBytes(4).toString('hex')}`;
    }

    const ext = path.extname(fileName);
    if (!ext) {
      const mimeExt = mime.extension(contentType);
      if (mimeExt) {
        fileName += `.${mimeExt}`;
        contentType = mime.lookup(fileName) || contentType;
      }
    } else {
      contentType = mime.lookup(fileName) || contentType;
    }

    return { fileName, contentType };
  } catch (error) {
    console.error("Failed to get file info:", error.message);
    throw error;
  }
}

function downloadFile(url, fileName) {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(os.tmpdir(), fileName);
    const writer = fs.createWriteStream(tempPath);

    axios({
      method: 'get',
      url: url,
      responseType: 'stream'
    }).then(response => {
      response.data.pipe(writer);
      writer.on('finish', () => resolve(tempPath));
      writer.on('error', err => {
        writer.close();
        fs.unlink(tempPath, () => reject(err));
      });
    }).catch(err => {
      writer.close();
      fs.unlink(tempPath, () => reject(err));
    });
  });
}

const execute = async (sock, msg, args) => {
  if (!args[0]) {
    return sock.sendMessage(msg.key.remoteJid, {
      text: "Masukkan link Instagram yang ingin diunduh!",
    });
  }

  try {
    const media = await igdown(args[0]);
    const processedUrls = new Set();

    for (const item of media.data) {
      if (processedUrls.has(item.url)) continue;
      processedUrls.add(item.url);

      try {
        const { fileName, contentType } = await getFileInfo(item.url);
        const filePath = await downloadFile(item.url, fileName);

        let messageContent;
        if (contentType.startsWith("video")) {
          messageContent = {
            video: fs.readFileSync(filePath),
            caption: fileName,
            mimetype: contentType
          };
        } else if (contentType.startsWith("image")) {
          messageContent = {
            image: fs.readFileSync(filePath),
            caption: fileName,
            mimetype: contentType
          };
        } else {
          messageContent = {
            document: fs.readFileSync(filePath),
            fileName: fileName,
            mimetype: contentType
          };
        }

        await sock.sendMessage(msg.key.remoteJid, messageContent);
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error(`Failed to process ${item.url}:`, error.message);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `Gagal mengunduh salah satu media: ${error.message}`,
        });
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
    await sock.sendMessage(msg.key.remoteJid, {
      text: `Gagal mengunduh media Instagram: ${err.message}`,
    });
  }
};

module.exports = {
  name: "Instagram Downloader",
  description: "Mengunduh media Instagram",
  command: `${config.prefix[1]}igdl`,
  commandType: "Downloader",
  isDependent: true,
  help: `Ketik ${config.prefix[1]}igdl [link_instagram] untuk mengunduhnya`,
  execute,
};