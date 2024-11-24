const { getOriginalUrl, downloadTrack } = require("../helper/spotify");
const fs = require("fs");
const path = require("path");
const os = require("os");
const ffmpeg = require('fluent-ffmpeg');
const config = require('../config'); 


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
      const outputPath = path.join(tempDir, "output.mpeg");
      fs.writeFileSync(inputPath, buffer);
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .toFormat("mpeg")
          .on("end", resolve)
          .on("error", reject)
          .save(outputPath);
      });
      await sock.sendMessage(from, {
        audio: { url: outputPath },
        ptt: false,
        mimetype: "audio/mpeg",
      });
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    }
  }
};

module.exports = {
  name: "Spotify",
  description: "Mendownload musik Spotify",
  command: `${config.prefix[1]}spotifydl`,
  commandType: "Downloader",
  isDependent: false,
  help: `unakan ${config.prefix[1]}spotifydl <artist name> <track name>`,
  execute,
};
