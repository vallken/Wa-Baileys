const cheerio = require("cheerio");
const axios = require("axios");
const config = require('../config'); 

async function execute(sock, msg, args) {
  if (!args.length) {
    return await sock.sendMessage(msg.key.remoteJid, { text: "Mohon masukkan nama zodiak. Contoh: !zodiak aries" });
  }

  const name = args[0].toLowerCase();
  const validZodiacs = ['capricorn', 'aquarius', 'pisces', 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius'];

  if (!validZodiacs.includes(name)) {
    return await sock.sendMessage(msg.key.remoteJid, { text: "Zodiak tidak valid. Silakan pilih dari daftar berikut:\n\n" + validZodiacs.join(', ') });
  }

  try {
    const response = await axios.get(`https://www.fimela.com/zodiak/${name}`);
    const $ = cheerio.load(response.data);

    const photo = $("body > div > div > div div > div > a > img").attr("src");
    const profil = $("div:nth-child(1) > div.zodiak--content__content > p").text().trim();
    const kesehatan = $("div:nth-child(2) > div.zodiak--content__content > p").text().trim();
    const love = $("body > div > div > div > div > div > div")
      .find("div:nth-child(3) > div.zodiak--content__content > p")
      .text()
      .replace("Couple", "\n\n- Couple")
      .replace("Single", "- Single")
      .trim();
    const karir = $("div:nth-child(4) > div.zodiak--content__content").text().trim();
    const keuangan = $("div.zodiak--content__readpage--left > div:nth-child(5) > div.zodiak--content__content").text().trim();
    const angka = $("div.zodiak--content__readpage--right > div:nth-child(1) > div.zodiak--content__content > span").text().trim();

    const caption = `
Ramalan Zodiak ${name.charAt(0).toUpperCase() + name.slice(1)} Hari Ini

*Profil:* 
${profil}

*Kesehatan:* 
${kesehatan}

*Love:* 
${love}

*Karir:* 
${karir}

*Keuangan:* 
${keuangan}

*Angka Keberuntungan:*
${angka}
    `;

    await sock.sendMessage(msg.key.remoteJid, {
      image: { url: photo },
      caption: caption,
    });
  } catch (error) {
    console.error("Error fetching zodiac info:", error);
    await sock.sendMessage(msg.key.remoteJid, { text: "Terjadi kesalahan saat mengambil informasi zodiak. Silakan coba lagi nanti." });
  }
}

module.exports = {
  name: "Zodiak Harian",
  description: "Ramalan Zodiak Harian Kamu",
  command: `${config.prefix[1]}zodiak`,
  commandType: "Info",
  isDependent: false,
  help: `Ketik ${config.prefix[1]}zodiak [nama zodiak] untuk melihat ramalan harian. Contoh: !zodiak aries`,
  execute,
};