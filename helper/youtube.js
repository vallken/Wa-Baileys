const fs = require("fs");
const fsPromises = require("fs").promises;
const ffmpeg = require("fluent-ffmpeg");
const ytdl = require("@distube/ytdl-core");
const path = require("path");
const os = require("os");
const axios = require("axios");
const { join } = require("path");
const tempDir = os.tmpdir();

const QUALITY_MAP = {
  1: "160", // 144p
  2: "134", // 360p
  3: "135", // 480p
  4: ["302", "136", "247"], // 720p
  5: ["303", "248"], // 1080p
  6: ["308", "271"], // 1440p
  7: ["315", "313"], // 2160p
  8: "highestaudio",
  9: "bitrateList",
};

const proxyUrl =
  "https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&protocol=http&proxy_format=protocolipport&format=json&timeout=20000";

// Fungsi untuk mendapatkan daftar proxy dari API
async function getProxy() {
  try {
    const response = await axios.get(proxyUrl);
    const proxyList = response.data.proxies;

    // Cek jika proxyList ada
    if (!proxyList || proxyList.length === 0) {
      throw new Error("Tidak ada proxy tersedia.");
    }

    // Pilih salah satu proxy secara acak
    const randomProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    const proxyData = randomProxy.proxy;
    console.log("Proxy yang dipilih:", proxyData);
    return proxyData;
  } catch (error) {
    console.error("Error fetching proxy:", error);
    return null;
  }
}

async function youtubeDownloader(link, qualityIndex, notificationCallback) {
  try {
    const quality = QUALITY_MAP[qualityIndex] || QUALITY_MAP[2];
    const info = await ytdl.getInfo(link);

    if (quality === "bitrateList") {
      return getBitrateList(info);
    }

    const videoDetails = info.videoDetails;
    const thumb =
      info.player_response.microformat.playerMicroformatRenderer.thumbnail
        .thumbnails[0].url;

    const format = await chooseFormat(info, quality);
    if (!format && qualityIndex <= 7) {
      throw new Error(
        `No video found with quality '${getQualityLabel(qualityIndex)}'P.`
      );
    }
    let result;
    if (qualityIndex > 7 || quality === "highestaudio") {
      result = await downloadAudioOnly(
        info,
        quality,
        videoDetails,
        thumb,
        notificationCallback
      );
    } else {
      result = await downloadVideoWithAudio(
        info,
        quality,
        videoDetails,
        thumb,
        notificationCallback
      );
    }
    return result;
  } catch (err) {
    console.error("Youtube Downloader Error:\n", err);
    return {
      creator: "@ShiroNexo",
      status: false,
      message: err.message,
    };
  }
}

function getBitrateList(info) {
  const bitrateList = info.formats
    .filter((element) => !element.hasVideo && element.hasAudio)
    .map((element) => ({
      codec: element.codecs,
      bitrate: element.audioBitrate,
      itag: element.itag,
    }))
    .sort((a, b) => b.bitrate - a.bitrate);

  return {
    creator: "@ShiroNexo",
    status: true,
    data: { bitrateList },
  };
}

async function chooseFormat(info, quality) {
  if (Array.isArray(quality)) {
    for (const q of quality) {
      try {
        const format = await ytdl.chooseFormat(info.formats, { quality: q });
        if (format) return format;
      } catch (e) {
        // Continue to next quality option
      }
    }
  }
  return await ytdl.chooseFormat(info.formats, { quality });
}

async function downloadAudioOnly(
  info,
  quality,
  videoDetails,
  thumb,
  notificationCallback
) {
  if (notificationCallback) {
    notificationCallback("Downloading audio...");
  }
  const audioStream = ytdl.downloadFromInfo(info, { quality });
  const tempMp3 = path.join(tempDir, `temp_audio_${Date.now()}.mp3`);
  await streamToFile(audioStream, tempMp3);
  if (notificationCallback) {
    notificationCallback("Audio download complete.");
  }
  const mp3Buffer = await fsPromises.readFile(tempMp3);
  await fsPromises.unlink(tempMp3);
  return createResponse(videoDetails, mp3Buffer, quality, thumb, "mp3");
}

async function downloadVideoWithAudio(
  info,
  quality,
  videoDetails,
  thumb,
  notificationCallback
) {
  const videoStream = ytdl.downloadFromInfo(info, { quality });
  const audioStream = ytdl.downloadFromInfo(info, { quality: "highestaudio" });

  const mp4File = path.join(tempDir, `buff_${Date.now()}.mp4`);
  const tempMp4 = path.join(tempDir, `temp_video_${Date.now()}.mp4`);
  const tempMp3 = path.join(tempDir, `temp_audio_${Date.now()}.mp4`);

  if (notificationCallback) {
    notificationCallback("Downloading audio and video...");
  }

  await Promise.all([
    streamToFile(audioStream, tempMp3),
    streamToFile(videoStream, tempMp4),
  ]);

  if (notificationCallback) {
    notificationCallback(
      "Audio and video download complete. \n\nMerging audio and video..."
    );
  }

  await mergeAudioVideo(tempMp3, tempMp4, mp4File);

  if (notificationCallback) {
    notificationCallback("Merge complete.");
  }

  const mp4Buffer = await fsPromises.readFile(mp4File);

  await Promise.all([
    fsPromises.unlink(tempMp3),
    fsPromises.unlink(tempMp4),
    fsPromises.unlink(mp4File),
  ]);

  return createResponse(videoDetails, mp4Buffer, quality, thumb, "mp4");
}

function streamToFile(stream, filePath) {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath);
    stream.pipe(writeStream);
    stream.on("end", resolve);
    stream.on("error", reject);
    writeStream.on("error", reject);
  });
}

function mergeAudioVideo(audioPath, videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(audioPath)
      .input(videoPath)
      .outputOptions("-c:v copy")
      .outputOptions("-c:a aac")
      .outputOptions("-strict experimental")
      .on("end", resolve)
      .on("error", reject)
      .save(outputPath);
  });
}

function createResponse(videoDetails, buffer, quality, thumb, type) {
  return {
    creator: "@ShiroNexo",
    status: true,
    data: {
      title: videoDetails.title,
      result: buffer,
      size: buffer.length,
      quality,
      desc: videoDetails.description,
      views: videoDetails.viewCount,
      likes: videoDetails.likes,
      dislikes: videoDetails.dislikes,
      channel: videoDetails.ownerChannelName,
      uploadDate: videoDetails.uploadDate,
      thumb,
      type,
    },
  };
}

function getQualityLabel(qualityIndex) {
  return ["144", "360", "480", "720", "1080", "1440", "2160"][qualityIndex - 1];
}

function sanitizeTitle(title) {
  return title
    .replace(/[\/\\:*?"<>|]/g, "_") // Ganti karakter yang tidak valid dengan underscore
    .trim(); // Hapus spasi di awal dan akhir
}

// Async function which scrapes the data
async function youtubePlaylistDownloader(
  url,
  quality,
  folderPath = join(process.cwd() + "/temp")
) {
  try {
    const playlistId = url.match(/[&?]list=([^&]+)/)?.[1];
    if (!playlistId) {
      throw new Error("Invalid Playlist URL");
    }
    console.log("Playlist ID: " + playlistId);
  } catch {
    console.log(
      "can't extract Playlist ID from URL. Check URL or Code (search for 'playlistId =')"
    );
    return {
      creator: "@ShiroNexo",
      status: false,
      message: e.message || "Invalid Playlist URL",
    };
  }
  try {
    const cookieString = cookiesArray
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    const { data } = await axios.get(url, {
      headers: {
        Cookie: cookieString,
      },
    });
    const htmlStr = data;
    fs.writeFileSync("./keys.txt", htmlStr);

    let arr = htmlStr.split('"watchEndpoint":{"videoId":"');
    var db = {};

    for (var i = 1; i < arr.length; i++) {
      let str = arr[i];
      let eI = str.indexOf('"');
      if (str.slice(eI, eI + 13) != '","playlistId') continue;
      let sstr = str.slice(0, eI);
      db[sstr] = 1;
    }
    console.log(Object.keys(db));
    console.log(Object.keys(db).length);
    let title = htmlStr.match(/property="og:title" content="(.+?)"/)?.[1];

    let resultPath = [];
    let metadata = [];

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
      console.log(`Folder ${folderPath} berhasil dibuat.`);
    }
    Object.keys(db).forEach(async (key) => {
      const info = await ytdl.getInfo(link);
      const videoTitle = info.videoDetails.title;
      const testPath = join(folderPath, `${sanitizeTitle(videoTitle)}.`);

      if (
        fs.existsSync(testPath + ".mp4") ||
        fs.existsSync(testPath + ".mp3")
      ) {
        console.log(`File ${videoTitle} already exists. Skipping...`);
        return;
      }
      await youtubeDownloader(key, quality).then((res) => {
        const filePath = join(
          folderPath,
          `${sanitizeTitle(res.data.title)}.${res.data.type}`
        );
        fs.writeFileSync(filePath, res.data.result);
        resultPath.push(filePath);
        metadata.push(res.data);
        console.log(`File ${videoTitle} saved to ${folderPath}`);
      });
    });

    return {
      creator: "@ShiroNexo",
      status: true,
      data: {
        title,
        resultPath,
        metadata,
      },
    };
  } catch (e) {
    console.log(e);
    return {
      creator: "@ShiroNexo",
      status: false,
      message: e.message || "Something went wrong.",
    };
  }
}

module.exports = { youtubeDownloader, youtubePlaylistDownloader };
