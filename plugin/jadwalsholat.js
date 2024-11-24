const jadwal = require("../helper/listKota.json");
const axios = require("axios");
const config = require('../config'); // Import konfigurasi prefix


const getFormattedDate = () => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

const execute = async (sock, msg, args) => {
  if (!args[0]) {
    return sock.sendMessage(msg.key.remoteJid, { text: "Masukkan nama kota!" });
  } else {
    try {
      const kota = jadwal.find((k) =>
        k.lokasi.toLowerCase().includes(args[0].toLowerCase())
      );
      if (kota) {
        const id = kota.id;
        const url = `https://api.myquran.com/v2/sholat/jadwal/${id}/${getFormattedDate()}`;
        const response = await axios.get(url);
        const data = await response.data.data;
        const jadwal = data.jadwal;
        await sock.sendMessage(msg.key.remoteJid, {
          text: `${data.lokasi} ${data.daerah}\n${jadwal.tanggal}\n\n- Imsak: ${jadwal.imsak}\n- Subuh: ${jadwal.subuh}\n- Terbit: ${jadwal.terbit}\n- Dhuha: ${jadwal.dhuha}\n- Dzuhur: ${jadwal.dzuhur}\n- Ashar: ${jadwal.ashar}\n- Magrhib: ${jadwal.maghrib}\n- Isya: ${jadwal.isya}`,
        });
      } else {
        return sock.sendMessage(msg.key.remoteJid, {
          text: "Kota yang anda cari tidak ditemukan!",
        });
      }
    } catch (err) {
      console.error(err);
      return sock.sendMessage(msg.key.remoteJid, {
        text: "Terjadi kesalahan saat mendapatkan data sholat!",
      });
    }
  }
};

module.exports = {
  name: "Jadwal Sholat",
  description: "Cari jadwal sholat di suatu kota",
  command: `${config.prefix[1]}jadwalsholat`,
  commandType: "plugin",
  isDependent: false,
  help: `Gunakan format ini:${config.prefix[1]}jadwalsholat <nama kota>`,
  execute,
};
