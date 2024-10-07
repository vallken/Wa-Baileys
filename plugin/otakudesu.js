const axios = require("axios");
const cheerio = require("cheerio");

const execute = async (sock, msg, args) => {
  const from = msg.key.remoteJid;

  if (args.length === 0) {
    return sock.sendMessage(from, { text: "Masukkan Perintah" });
  }

  try {
    if (args[0].toLowerCase() === "terbaru") {
      await fetchLatestAnime(sock, from);
    } else {
      await searchAnime(sock, from, args);
    }
  } catch (error) {
    console.error(error);
    sock.sendMessage(from, {
      text: "Terjadi kesalahan saat memproses permintaan Anda.",
    });
  }
};

const fetchLatestAnime = async (sock, from) => {
  try {
    const response = await axios.get("https://otakudesu.cloud/ongoing-anime/");
    const $ = cheerio.load(response.data);
    const days = {};

    $(".venz ul li").each((_, element) => {
      const day = `${$(element).find(".epztipe").text()} ${$(element).find(".newnime").text()}`;
      if (!days[day]) days[day] = [];
      days[day].push(`${$(element).find(".thumbz h2").text()} ${$(element).find(".epz").text()}`);
    });

    const text = Object.entries(days)
      .map(([day, animes]) => `📅 ${day}:\n${animes.map((anime, i) => `${i + 1}. ${anime}`).join("\n")}`)
      .join("\n\n");

    sock.sendMessage(from, { text });
  } catch (error) {
    console.error(error);
    sock.sendMessage(from, { text: "Gagal memuat anime terbaru." });
  }
};

const searchAnime = async (sock, from, args) => {
  try {
    const response = await axios.get(`https://otakudesu.cloud/?s=${args.join(" ")}&post_type=anime`);
    const $ = cheerio.load(response.data);
    const links = $("li h2 a");

    if (links.length === 0) {
      return sock.sendMessage(from, { text: "Anime tidak ditemukan." });
    }

    const searchResults = ["Hasil Pencarian:"]
      .concat(links.map((i, el) => `${i + 1}. ${$(el).text()}`).get())
      .concat(["", "Pilih nomor:"])
      .join("\n");

    sock.sendMessage(from, { text: searchResults });

    const selectedIndex = await waitForResponse(sock, from);
    if (selectedIndex >= 0 && selectedIndex < links.length) {
      const selectedJudul = $(links[selectedIndex]).attr("href");
      await selectEpisode(sock, from, selectedJudul);
    } else {
      sock.sendMessage(from, { text: "Nomor tidak valid." });
    }
  } catch (error) {
    console.error(error);
    sock.sendMessage(from, { text: "Gagal mencari anime." });
  }
};

const selectEpisode = async (sock, from, selectedJudul) => {
  try {
    const response = await axios.get(selectedJudul);
    const $ = cheerio.load(response.data);
    const episodeList = $(".episodelist").eq(1).find("ul li").toArray();

    if (episodeList.length === 0) {
      return sock.sendMessage(from, { text: "Tidak ada episode yang ditemukan." });
    }

    // Reverse the episode list for display purposes
    const reversedEpisodeList = episodeList.reverse();

    const episodeTitle = ["Episode Ditemukan:"]
      .concat(reversedEpisodeList.map((element, index) => `${index + 1}. ${$(element).find("a").text()}`))
      .concat(["", "Pilih Episode:"])
      .join("\n");

    sock.sendMessage(from, { text: episodeTitle });

    const selectedIndex = await waitForResponse(sock, from);
    if (selectedIndex >= 0 && selectedIndex < episodeList.length) {
      // Use the selectedIndex directly since the list is already reversed
      const selectedEps = $(reversedEpisodeList[selectedIndex]).find("a").attr("href");
      await selectResolution(sock, from, selectedEps);
    } else {
      sock.sendMessage(from, { text: "Nomor tidak valid." });
    }
  } catch (error) {
    console.error(error);
    sock.sendMessage(from, { text: "Gagal memuat episode." });
  }
};

const selectResolution = async (sock, from, selectedEps) => {
  try {
    const response = await axios.get(selectedEps);
    const $ = cheerio.load(response.data);
    const resList = $(".download ul li");

    if (resList.length === 0) {
      return sock.sendMessage(from, { text: "Tidak ada resolusi yang ditemukan." });
    }

    const resolutionList = ["Resolusi Ditemukan:"]
      .concat(resList.map((i, el) => `${i + 1}. ${$(el).find("strong").text()} ${$(el).find("i").text()}`).get())
      .concat(["", "Pilih Resolusi:"])
      .join("\n");

    sock.sendMessage(from, { text: resolutionList });

    const selectedIndex = await waitForResponse(sock, from);
    if (selectedIndex >= 0 && selectedIndex < resList.length) {
      const result = $(resList[selectedIndex]).find("a");
      const providerList = ["Link Download:"]
        .concat(result.map((i, el) => `${i + 1}. ${$(el).text()} => ${$(el).attr("href")}`).get())
        .join("\n");
      sock.sendMessage(from, { text: providerList });
    } else {
      sock.sendMessage(from, { text: "Nomor tidak valid." });
    }
  } catch (error) {
    console.error(error);
    sock.sendMessage(from, { text: "Gagal memuat resolusi." });
  }
};

const waitForResponse = (sock, from) => {
  return new Promise((resolve) => {
    const listener = async (messageUpsert) => {
      if (messageUpsert.type !== "notify") return;

      const msg = messageUpsert.messages[0];
      if (!msg || !msg.key || msg.key.remoteJid !== from) return;

      const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

      if (messageText && !isNaN(messageText.trim())) {
        clearTimeout(timeout);
        sock.ev.off("messages.upsert", listener);
        resolve(parseInt(messageText.trim()) - 1);
      }
    };

    sock.ev.on("messages.upsert", listener);

    const timeout = setTimeout(() => {
      sock.ev.off("messages.upsert", listener);
      sock.sendMessage(from, { text: "Waktu memilih habis. Silakan coba lagi." });
      resolve(-1);
    }, 60000);
  });
};

module.exports = {
  name: "Anime Download",
  description: "Download Anime Subtitle Indonesia",
  command: `${global.prefix[1]}otakudesu`,
  commandType: "plugin",
  isDependent: false,
  help: `1. Ketik ${global.prefix[1]}otakudesu <judul> untuk mencari link\n2. Ketik ${global.prefix}otakudesu terbaru untuk melihat informasi anime terbaru`,
  execute,
};