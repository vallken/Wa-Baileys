const yt = require("../helper/youtube");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const os = require("os");
const config = require('../config'); 


/**
 * Crops a video/audio buffer using ffmpeg
 * @param {Buffer} inputBuffer - The buffer of the video/audio file
 * @param {string} startTime - The start time for cropping (format: hh:mm:ss)
 * @param {string} endTime - The end time for cropping (format: hh:mm:ss)
 * @returns {Promise<Buffer>} - The cropped buffer
 */
async function cropMedia(inputBuffer, startTime, endTime) {
  return new Promise((resolve, reject) => {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `input_${Date.now()}.mp4`);
    const outputPath = path.join(tempDir, `output_${Date.now()}.mp4`);

    fs.writeFileSync(inputPath, inputBuffer);

    ffmpeg(inputPath)
      .setStartTime(startTime)
      .duration(endTime)
      .output(outputPath)
      .on("start", (commandLine) =>
        console.log("FFmpeg process started:", commandLine)
      )
      .on("progress", (progress) =>
        console.log(`Processing: ${progress.percent}% done`)
      )
      .on("end", () => {
        console.log("Crop completed");
        const outputBuffer = fs.readFileSync(outputPath);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        resolve(outputBuffer);
      })
      .on("error", (err) => {
        console.error("Error cropping media:", err);
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        reject(err);
      })
      .run();
  });
}

/**
 * Waits for a user response
 * @param {Object} sock - The socket object
 * @param {string} from - The sender's ID
 * @param {boolean} isTimeFormat - Whether to expect a time format response
 * @returns {Promise<number|string>} - The user's response
 */
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

/**
 * Handles the YouTube download process
 * @param {Object} sock - The socket object
 * @param {Object} msg - The message object
 * @param {string[]} args - Command arguments
 */
const execute = async (sock, msg, args) => {
  const from = msg.key.remoteJid;

  if (args.length === 0) {
    return sock.sendMessage(from, { text: "Usage: !yt <video_url>" });
  }

  const videoUrl = args[0];
  await sock.sendMessage(from, {
    text: "Pilih kualitas:\n\n1: 144p\n2: 360p\n3: 480p\n4: 720p\n5: 1080p\n6: 1440p\n7: 2160p\n8: highestaudio/mp3/audio",
  });

  const selectedIndex = await waitForResponse(sock, from);
  if (selectedIndex < 0 || selectedIndex >= 8) {
    return sock.sendMessage(from, { text: "Nomor tidak valid." });
  }

  await sock.sendMessage(from, { text: "Tunggu Sebentar..." });

  const response = await yt.youtubeDownloader(videoUrl, selectedIndex + 1);
  if (!response.status) {
    return sock.sendMessage(from, { text: response.message });
  }
  if (selectedIndex < 7) {
    await sock.sendMessage(from, { text: "Crop Media?\n1. Ya\n2. Tidak" });
    const selectCrop = await waitForResponse(sock, from);

    if (selectCrop === 0) {
      await sock.sendMessage(from, { text: "Masukkan waktu awal (hh:mm:ss):" });
      const startTime = await waitForResponse(sock, from, true);
      await sock.sendMessage(from, {
        text: "Masukkan waktu akhir (hh:mm:ss):",
      });
      const endTime = await waitForResponse(sock, from, true);

      try {
        const croppedBuffer = await cropMedia(
          response.data.result,
          startTime,
          endTime
        );
        sock.sendMessage(from, { text: "tunggu sebentar...." });
        await sock.sendMessage(from, { video: croppedBuffer });
      } catch (error) {
        console.error("Error in cropping:", error);
        await sock.sendMessage(from, {
          text: "Terjadi kesalahan saat memotong video. Silakan coba lagi.",
        });
      }
    } else {
      await sock.sendMessage(from, {
        text: `Mengirim ${response.data.title}...`,
      });
      await sock.sendMessage(from, { video: response.data.result });
    }
  }

  if (selectedIndex > 6) {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `input.mp3`);
    fs.writeFileSync(inputPath, response.data.result);
    await sock.sendMessage(from, {
      audio: { url: inputPath },
      ptt: false,
      mimetype: "audio/mpeg",
      filename: `${response.data.title}.mpeg`,
    });
    fs.unlinkSync(inputPath);
  } else {
    await sock.sendMessage(from, { video: response.data.result });
  }
};

module.exports = {
  name: "Youtube Downloader",
  description: "Download video Youtube dengan kualitas yang diinginkan",
  command: `${config.prefix[1]}ytdl`,
  commandType: "Utility",
  isDependent: false,
  help: `\nKetik ${config.prefix[1]}yt [link_video_youtube] untuk mengunduhnya`,
  execute,
};
