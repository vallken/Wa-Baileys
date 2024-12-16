const axios = require("axios");
const config = require('../config'); 

const API_ENDPOINT = "https://twitter-video-download.com/en/tweet/";
const REGEX_VIDEO_LINK = /https:\/\/[a-zA-Z0-9_-]+\.twimg\.com\/[a-zA-Z0-9_\-./]+\.mp4/g;


async function fetchTweetMedia(tweetId) {
  try {
    const url = `${API_ENDPOINT}${tweetId}`;
    console.log(`[INFO] Fetching media from: ${url}`);

    // Permintaan HTTP menggunakan axios
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      },
    });


    const links = response.data.match(REGEX_VIDEO_LINK);
    if (!links || links.length === 0) {
      console.log(`[ERROR] No media found for Tweet ID: ${tweetId}`);
      return null;
    }

    const sortedLinks = Array.from(new Set(links)).sort((a, b) => {
      const getResolution = (url) => {
        const match = url.match(/\/(\d+x\d+)\//);
        return match ? parseInt(match[1].split("x")[0]) * parseInt(match[1].split("x")[1]) : 0;
      };
      return getResolution(b) - getResolution(a); 
    });

    const lq = sortedLinks[0];
    const hq = sortedLinks[sortedLinks.length - 1];
    return { lq, hq };
  } catch (error) {
    console.error(`[ERROR] Failed to fetch media: ${error.message}`);
    return null;
  }
}
const isValidURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
};
function extractTwitterIDAdvanced(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/[^\/]+\/status\/(\d+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

const execute = async (sock, msg, args) => {
  if (!args) {
    return sock.sendMessage(msg.key.remoteJid, {
      text: `Gunakan ${config.prefix[1]}xdl <link>`,
    });
  } else {
    try {
      if (isValidURL(args[0])) {
        const tweetId = extractTwitterIDAdvanced(args[0]);
        if (!tweetId) {
          throw new Error("Invalid Twitter URL");
        } 
        const { lq, hq } = await fetchTweetMedia(tweetId);
        if (!lq || !hq){
          await sock.sendMessage(msg.key.remoteJid,{
            text: "Video tidak ditemukan"
          })
        }
        await sock.sendMessage(msg.key.remoteJid, {
          video: {url: hq ? hq : lq}
        })

      }
    } catch (e) {
      console.log(e);
      sock.sendMessage(msg.key.remoteJid, {
        text: e.message,
      });
    }
  }
};

module.exports = {
  name: "Twitter Downloader",
  description: "Download Video Twitter",
  command: `${config.prefix[1]}xdl`,
  commandType: "Downloader",
  isDependent: false,
  help: `Gunakan ${config.prefix[1]}xdl <link> `,
  execute,
};
