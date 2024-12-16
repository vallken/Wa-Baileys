const Genius = require("genius-lyrics");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const config = require("../config");

const Client = new Genius.Client(process.env.GENIUS);

const waitForResponse = (sock, from) => {
  return new Promise((resolve, reject) => {
    const listener = async (messageUpsert) => {
      try {
        if (messageUpsert.type !== "notify") return;

        const msg = messageUpsert.messages[0];
        if (!msg || !msg.key || msg.key.remoteJid !== from) return;

        const messageText =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          "";

        const selectedNumber = parseInt(messageText.trim());
        if (messageText && !isNaN(selectedNumber) && selectedNumber > 0) {
          clearTimeout(timeout);
          sock.ev.off("messages.upsert", listener);
          resolve(selectedNumber - 1);
        }
      } catch (error) {
        console.error("Error in waitForResponse listener:", error);
        reject(error);
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

const execute = async (sock, msg, args) => {
  const from = msg.key.remoteJid;
  
  try {
    if (args.length < 1) {
      return sock.sendMessage(from, {
        text: `Gunakan ${config.prefix[1]}lirik <Judul Lagu>`,
      });
    }

    const songTitle = args.join(" ");
    
    let searches;
    try {
      searches = await Client.songs.search(songTitle);
    } catch (searchError) {
      console.error("Error searching for songs:", searchError);
      return sock.sendMessage(from, { 
        text: "Maaf, terjadi kesalahan saat mencari lagu. Coba lagi nanti." 
      });
    }

    if (!searches || searches.length === 0) {
      return sock.sendMessage(from, { 
        text: "Tidak ada lagu yang ditemukan. Coba dengan judul yang berbeda." 
      });
    }

    const limitedSearches = searches.slice(0, 10);
    const textTitle = limitedSearches.map((key, index) => {
      return `${index + 1}. ${key.title} - ${key.artist.name}`;
    }).join("\n");

    const pesanAwal = await sock.sendMessage(from, { 
      text: `Pilih salah satu lagu (1-${limitedSearches.length}):\n${textTitle}` 
    }, { quoted: msg });

    const selectedSong = await waitForResponse(sock, from);

    if (selectedSong >= 0 && selectedSong < limitedSearches.length) {
      const songLyrics = limitedSearches[selectedSong];
      
      let lyrics;
      try {
        lyrics = await songLyrics.lyrics();
      } catch (lyricsError) {
        console.error("Error fetching lyrics:", lyricsError);
        return sock.sendMessage(from, { 
          text: "Maaf, tidak dapat mengambil lirik lagu saat ini." 
        });
      }

      if (!lyrics || lyrics.trim() === "") {
        return sock.sendMessage(from, { 
          text: "Maaf, lirik tidak tersedia untuk lagu ini." 
        });
      }

      await sock.updateMessage(from, { text: lyrics }, { key: pesanAwal });
    } else {
      await sock.sendMessage(from, { 
        text: "Pilihan tidak valid. Silakan coba lagi." 
      });
    }
  } catch (error) {
    console.error("Unexpected error in lyrics command:", error);
    await sock.sendMessage(from, { 
      text: "Terjadi kesalahan tidak terduga. Silakan coba lagi." 
    });
  }
};

module.exports = {
  name: "Lirik Lagu",
  description: "Mencari dan menampilkan lirik lagu",
  command: `${config.prefix[1]}lirik`,
  commandType: "Utility",
  isDependent: false,
  help: `Gunakan ${config.prefix[1]}lirik <Judul Lagu>`,
  execute,
};