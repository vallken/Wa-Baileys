const { getOriginalUrl, downloadTrack } = require("../helper/spotify");
const fs = require("fs");
const path = require("path");
const os = require("os");

const execute = async (sock, msg, args) => {
  const from = msg.key.remoteJid;
  if (args.length < 1) {
    return sock.sendMessage(from, {
      text: "Usage: !spotify <track name> <artist name>",
    });
  } else {
    const trackName = args.join(" ");
    const track = await downloadTrack(trackName);
    if (!track) {
      return sock.sendMessage(from, {
        text: "Gagal mendownload track.",
      });
    } else {
      const buffer = await track.audioBuffer;
      sock.sendMessage(from, "Sedang diproses...");
      const tempDir = os.tmpdir();
      const inputPath = path.join(tempDir, `input.mp3`);
      fs.writeFileSync(inputPath, buffer);
      await sock.sendMessage(from, {
        audio: {url: inputPath},
        ptt: false,
        mimetype: 'audio/mpeg'
    });
      fs.unlinkSync(inputPath);
    }
  }
};

module.exports = {
  name: "Spotify",
  description: "Mendownload musik Spotify",
  command: "!spotifydl",
  commandType: "Downloader",
  isDependent: false,
  help: "Gunakan !spotifydl <artist name> <track name> ",
  execute,
};
