const axios_1 = require("axios");
const cheerio_1 = require("cheerio");
const TiktokURLregex =
  /https:\/\/(?:m|www|vm|vt|lite)?\.?tiktok\.com\/((?:.*\b(?:(?:usr|v|embed|user|video|photo)\/|\?shareId=|\&item_id=)(\d+))|\w+)/;
const getRequest = (url) =>
  new Promise((resolve) => {
    if (!TiktokURLregex.test(url)) {
      return resolve({
        status: "error",
        message: "Invalid Tiktok URL. Make sure your url is correct!",
      });
    }
    (0, axios_1.default)("https://musicaldown.com", {
      method: "GET",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Update-Insecure-Requests": "1",
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
      },
    })
      .then((data) => {
        const cookie = data.headers["set-cookie"][0].split(";")[0];
        const $ = (0, cheerio_1.load)(data.data);
        const input = $("div > input").map((_, el) => $(el));
        const request = {
          [input.get(0).attr("name")]: url,
          [input.get(1).attr("name")]: input.get(1).attr("value"),
          [input.get(2).attr("name")]: input.get(2).attr("value"),
        };
        resolve({ status: "success", request, cookie });
      })
      .catch((e) =>
        resolve({ status: "error", message: "Failed to get the request form!" })
      );
  });
const getMusic = (cookie) =>
  new Promise((resolve) => {
    (0, axios_1.default)("https://musicaldown.com/mp3/download", {
      method: "GET",
      headers: {
        cookie: cookie,
        "Upgrade-Insecure-Requests": "1",
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
      },
    })
      .then(({ data }) => {
        const $ = (0, cheerio_1.load)(data);
        const music = $("audio > source").attr("src");
        resolve({ status: "success", result: music });
      })
      .catch((e) => resolve({ status: "error" }));
  });
const MusicalDown = (url) =>
  new Promise(async (resolve) => {
    const request = await getRequest(url);
    if (request.status !== "success")
      return resolve({ status: "error", message: request.message });
    (0, axios_1.default)("https://musicaldown.com/download", {
      method: "POST",
      headers: {
        cookie: request.cookie,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://musicaldown.com",
        Referer: "https://musicaldown.com/en",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
      },
      data: new URLSearchParams(Object.entries(request.request)),
    })
      .then(async ({ data }) => {
        const $ = (0, cheerio_1.load)(data);
        const images = [];
        $("div.row > div[class='col s12 m3']")
          .get()
          .map((v) => {
            images.push($(v).find("img").attr("src"));
          });
        let i = 1;
        let videos = {};
        $("div[class='col s12 l8'] > a")
          .get()
          .map((v) => {
            if ($(v).attr("href") !== "#modal2") {
              let text = $(v)
                .text()
                .trim()
                .replace(/\s/, " ")
                .replace("arrow_downward", "")
                .toLowerCase();
              videos[
                text.includes("hd")
                  ? "videoHD"
                  : text.includes("watermark")
                  ? "videoWatermark"
                  : `video${i}`
              ] = $(v).attr("href");
              i++;
            }
          });
        if (images.length !== 0) {
          resolve({
            status: "success",
            result: {
              type: "image",
              author: {
                nickname: $("h2.white-text")
                  .text()
                  .trim()
                  .replace("Download Now: Check out ", "")
                  .replace(
                    "’s video! #TikTok >If MusicallyDown has helped you, you can help us too",
                    ""
                  )
                  .replace("Download Now: ", "")
                  .replace(
                    "If MusicallyDown has helped you, you can help us too",
                    ""
                  ),
              },
              images,
              music: $("a.download").attr("href"),
            },
          });
        } else {
          const music = await getMusic(request.cookie);
          resolve({
            status: "success",
            result: {
              type: "video",
              author: {
                avatar: $("div.img-area > img").attr("src"),
                nickname: $("div.row > div > div > h2")
                  .map((_, el) => $(el).text())
                  .get(0),
              },
              desc: $("div.row > div > div > h2")
                .map((_, el) => $(el).text())
                .get(1),
              music: music.result,
              ...videos,
            },
          });
        }
      })
      .catch((e) => resolve({ status: "error", message: e.message }));
  });

exports.MusicalDown = MusicalDown