const axios = require("axios");
const qs = require("qs");
const cheerio = require("cheerio");

function isValidURL(input) {
  try {
    new URL(input);
    return true;
  } catch (e) {
    return false;
  }
}

const execute = async (sock, msg, args) => {
  const from = msg.key.remoteJid;
  try {
    if (!args) {
      sock.sendMessage(from, { text: "Masukkan URL Instagram!" });
    } else if (isValidURL(args[0])) {
      sock.sendMessage(from, { text: "Mohon tunggu..." });
      const res = await axios.post(
        "https://v3.saveig.app/api/ajaxSearch",
        require("querystring").stringify({
          q: args[0],
          t: "media",
          lang: "en",
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept-Encoding": "gzip, deflate, br",
            Origin: "https://saveig.app/en",
            Referer: "https://saveig.app/en",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "User-Agent": "PostmanRuntime/7.31.1",
          },
        }
      );
      let $ = cheerio.load(await res.data.data);

      let data = [];
      const downloadItems = $('div[class="download-items__btn"]');
      downloadItems.each((i, e) => {
        const type = $(e).find("a").attr("id").match("photo")
          ? "image"
          : "video";
        const url = $(e).find("a").attr("href");
        data.push({ type, url });
      });
      if (data[0].type === "video") {
        const urlData = data[0].url;
        const response = await axios.get(urlData, { responseType: "stream" });
        const videoBuffer = await new Promise((resolve, reject) => {
          const chunks = [];
          response.data.on("data", (chunk) => chunks.push(chunk));
          response.data.on("end", () => resolve(Buffer.concat(chunks)));
          response.data.on("error", (error) => reject(error));
        });
        await sock.sendMessage(from, {
          video: videoBuffer,
          caption: "Berhasil diunduh",
        });
      } else {
        for (let i = 0; i < data.length; i++) {
          const media = data[i].url;
          await sock.sendMessage(from, {
            image: { url: media },
          });
        }
      }
    } else {
      sock.sendMessage(from, { text: "URL yang anda masukkan salah" });
    }
  } catch (error) {
    console.log(error);
    sock.sendMessage(from, { text: "Terjadi Kesalahan saat memproses media" });
  }
};

module.exports = {
  name: "Instagram Downloader",
  description: "Download Video / Gambar dari Instagram",
  command: "!igdl",
  commandType: "downloader",
  isDependent: false,
  help: `ketik !igdl [url] untuk menggunakannya`,
  execute,
};
