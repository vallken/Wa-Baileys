const axios = require("axios");
const url = "https://tools.betabotz.eu.org/tools/twitterdl?url=";

const isValidURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
};

const execute = async (sock, msg, args) => {
  if (!args) {
    return sock.sendMessage(msg.key.remoteJid, {
      text: "Masukkan URL Twitter yang ingin diunduh.",
    });
  } else {
    try {
      if (isValidURL(args[0])) {
        const response = await axios.get(url + args[0]);
        const data = response.data.result;

        if (response.status === 200) {
          for (let i = 0; i < data.media_extended.length; i++) {
            const mediaItem = data.media_extended[i];

            if (mediaItem.type === "video") {
              const headResponse = await axios.head(mediaItem.url);
              const contentLength = headResponse.headers["content-length"];
              const fileSizeInMB = contentLength / (1024 * 1024);

              if (fileSizeInMB > 10) {
                await sock.sendMessage(msg.key.remoteJid, {
                  text: `Ukuran video ${fileSizeInMB.toFixed(
                    2
                  )}MB melebihi batas maksimal 10MB.\n\nSilahkan download melalui link berikut:\n${
                    mediaItem.url
                  }`,
                });
              } else {
                await sock.sendMessage(msg.key.remoteJid, {
                  video: { url: mediaItem.url },
                  caption: data.text,
                });
              }
            } else {
              await sock.sendMessage(msg.key.remoteJid, {
                image: {
                  url: mediaItem.url,
                },
                caption: data.text,
              });
            }
          }
        }
      } else {
        sock.sendMessage(msg.key.remoteJid, {
          text: "URL yang Anda masukkan salah. Harap masukkan URL Twitter yang valid.",
        });
      }
    } catch (e) {
      console.log(e);
      sock.sendMessage(msg.key.remoteJid, {
        text: "Terjadi kesalahan saat melakukan download.",
      });
    }
  }
};

module.exports = {
  name: "Twitter Downloader",
  description: "Download Video / Gambar Twitter",
  command: "!twitterdl <url>",
  commandType: "Downloader",
  isDependent: false,
  execute,
};
