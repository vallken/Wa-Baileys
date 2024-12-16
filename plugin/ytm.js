const config = require("../config");
const yts = require( 'yt-search' )
const yt = require("../helper/youtube");
const fs = require("fs");
const path = require("path");
const os = require("os");

const waitForResponse = (sock, from, isTimeFormat = false) => {
  return new Promise((resolve) => {
    const listener = async (messageUpsert) => {
      if (messageUpsert.type !== "notify") return;

      const msg = messageUpsert.messages[0];
      if (!msg || !msg.key || msg.key.remoteJid !== from) return;

      let messageText =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";

      if (messageText) {
        if (isTimeFormat) {
          const timeRegex =
            /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
          if (timeRegex.test(messageText.trim())) {
            clearTimeout(timeout);
            sock.ev.off("messages.upsert", listener);
            resolve(messageText.trim());
          } else {
            sock.sendMessage(from, {
              text: "Format waktu tidak valid. Gunakan format HH:MM:SS.",
            });
          }
        } else if (!isNaN(messageText.trim())) {
          clearTimeout(timeout);
          sock.ev.off("messages.upsert", listener);
          resolve(parseInt(messageText.trim()) - 1);
        }
      }
    };

    sock.ev.on("messages.upsert", listener);

    const timeout = setTimeout(() => {
      sock.ev.off("messages.upsert", listener);
      sock.sendMessage(from, {
        text: "Waktu memilih habis. Silakan coba lagi.",
      });
      resolve(-1);
    }, 60000);
  });
};

const linkHandler = async (name) => {
  try {
    const music = await yts(name);
    return music.videos;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

const execute = async (sock, msg, args) => {
  const from = msg.key.remoteJid;
  if (args.length === 0) {
    return sock.sendMessage(from, {
      text: `Gunakan Perintah ${config.prefix[1]}ytm <Judul Lagu>`,
    });
  } else {
    let searches;
    try {
      searches = await linkHandler(args.join(" "));
    } catch (e) {
      console.error("Error searching for songs:", searchError);
      return sock.sendMessage(from, {
        text: "Maaf, terjadi kesalahan saat mencari lagu. Coba lagi nanti.",
      });
    }
    if (!searches || searches.length === 0) {
      return sock.sendMessage(from, {
        text: "Tidak ada lagu yang ditemukan. Coba dengan judul yang berbeda.",
      });
    }
    const limitedSearches = searches.slice(0, 5);
    const textTitle = limitedSearches
      .map((v, index) => {
        return `${index + 1}. ${ v.title } (${ v.timestamp }) | ${ v.author.name }`;
      })
      .join("\n");
    await sock.sendMessage(
      from,
      {
        text: `Pilih salah satu lagu (1-${limitedSearches.length}):\n${textTitle}`,
      },
      { quoted: msg }
    );
    const selectedSong = await waitForResponse(sock, from);
    if (selectedSong >= 0 && selectedSong < limitedSearches.length) {
      const linkSong = limitedSearches[selectedSong].url;
      try {
        await sock.sendMessage(from, { text: "Tunggu Sebentar" });
        ``;
        const response = await yt.youtubeDownloader(
          linkSong,
          8
        );
        const tempDir = os.tmpdir();
        const inputPath = path.join(tempDir, `input.mp3`);
        fs.writeFileSync(inputPath, response.data.result);
        await sock.sendMessage(from, {
          document: { url: inputPath },
          mimetype: "audio/mpeg", 
          fileName: `${response.data.title}`, 
        });

        fs.unlinkSync(inputPath);
      } catch (e) {
        console.error(e);
        return sock.sendMessage(from, {
          text: "Terjadi kesalahan saat mendownload lagu. Coba lagi nanti.",
        });
      }
    } else {
        return sock.sendMessage(from, {
          text: "Pilihan tidak valid. Silakan coba lagi.",
        });
    }
  }
};

module.exports = {
  name: "Youtube Music",
  description: "Mendownload lagu di Youtube Music",
  command: `${config.prefix[1]}ytm`,
  commandType: "Music",
  isDependent: false,
  help: `Gunakan Perintah ${config.prefix[1]}ytm <Judul Lagu>`,
  execute,
};
