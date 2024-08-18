const axios = require("axios");
const cheerio = require("cheerio");
const readlineSync = require("readline-sync");
const useAgent = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
};

const selectEpisodeAndResolution = async () => {
  const animeUrl = await searchAnime();
  if (!animeUrl) {
    console.log("Anime tidak ditemukan");
  } else {
    const req = await axios.get(animeUrl, { headers: useAgent });
    const $ = cheerio.load(req.data);

    const episodes = [];
    $(".entry-content")
      .find("table")
      .each((index, element) => {
        const episodeTitle = $(element).find("td").text().trim();
        const downloadLinks = [];
        $(element)
          .next("table")
          .find("a")
          .each((i, a) => {
            const link = $(a).attr("href");
            downloadLinks.push(link);
          });
        episodes.push({ episodeTitle, downloadLinks });
      });

    if (episodes.length === 0) {
      console.log("Tidak ada episode yang ditemukan");
      return;
    }

    console.log("Daftar Episode:");
    episodes.forEach((episode, index) => {
      console.log(`${index + 1}. ${episode.episodeTitle}`);
      console.log("Download Links:", episode.downloadLinks);
      console.log("---------------------------");
    });
  }
};


const searchAnime = async () => {
  const judul = readlineSync.question("Judul Anime:");
  const req = await axios.get("https://meownime.ltd/?s=" + judul, {
    headers: useAgent,
  });
  const $ = cheerio.load(req.data);
  const link = $(".site-main").find("article");

  if (link.length > 0 && link.find("a").attr("title")) {
    for (let i = 0; i < link.length; i++) {
      console.log(
        `Ditemukan..\n${i + 1} ${$(link[i]).find("a").attr("title")}`
      );
    }
    const nomor = readlineSync.question("Pilih Yang Mana:");
    const animeUrl = $(link[nomor - 1]).find("a").attr("href");
    return animeUrl;
  } else {
    console.log("Tidak Ditemukan");
    return null;
  }
};

const main = async () => {
  const animeUrl = await searchAnime();
  if (animeUrl) {
    await selectEpisodeAndResolution(animeUrl);
  }
};

main();
