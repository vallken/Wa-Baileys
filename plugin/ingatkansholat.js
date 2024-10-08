const axios = require("axios");
const cron = require("node-cron");
const fs = require("fs").promises;
const path = require("path");
const Jadwal = require("../lib/db/jadwal");


const filePath = path.resolve(__dirname, "../helper/listKota.json");

let listKota;
let scheduleJobs = {};

const readListKota = async () => {
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    listKota = JSON.parse(fileContent);
  } catch (error) {
    console.error("Error reading listKota.json:", error);
    listKota = [];
  }
};

const getFormattedDate = () => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

const setJadwalStatus = async (userId, kota, jadwal) => {
  try {
    await Jadwal.findOneAndUpdate(
      { userId },
      { kota, jadwal, timestamp: new Date() },
      { upsert: true, new: true }
    );
    console.log(`Jadwal status set for user ${userId}`);
  } catch (err) {
    console.error("Error setting jadwal status:", err);
  }
};

const getJadwalStatus = async (userId) => {
  try {
    return await Jadwal.findOne({ userId });
  } catch (err) {
    console.error("Error getting jadwal status:", err);
    return null;
  }
};

const removeJadwalStatus = async (userId) => {
  try {
    await Jadwal.findOneAndDelete({ userId });

    if (scheduleJobs[userId]) {
      scheduleJobs[userId].forEach((job) => job.stop());
      delete scheduleJobs[userId];
    }

    console.log(`Jadwal status removed for user ${userId}`);
  } catch (err) {
    console.error("Error removing jadwal status:", err);
  }
};

const getNewSchedule = async (id) => {
  const url = `https://api.myquran.com/v2/sholat/jadwal/${id}/${getFormattedDate()}`;
  try {
    const response = await axios.get(url);
    return response.data.data.jadwal;
  } catch (err) {
    console.error("Error fetching new schedule:", err);
    return null;
  }
};

const sendMessage = (sock, userId, time, prayerName) => {
  const message = `Waktu sholat ${prayerName} telah tiba pada ${time}.`;
  sock.sendMessage(userId, { text: message });
};

const schedulePrayerTimes = (jadwal, sock, userId) => {
  if (scheduleJobs[userId]) {
    scheduleJobs[userId].forEach((job) => job.stop());
  }
  scheduleJobs[userId] = [];

  const scheduleTime = (time, prayerName) => {
    const [hour, minute] = time.split(":");
    const cronExpression = `${minute} ${hour} * * *`;
    const job = cron.schedule(
      cronExpression,
      () => {
        sendMessage(sock, userId, time, prayerName);
      },
      {
        timezone: "Asia/Jakarta",
      }
    );
    scheduleJobs[userId].push(job);
  };

  const prayerTimes = [
    { time: jadwal.imsak, name: "Imsak" },
    { time: jadwal.subuh, name: "Subuh" },
    // { time: jadwal.terbit, name: "Terbit" },
    { time: jadwal.dhuha, name: "Dhuha" },
    { time: jadwal.dzuhur, name: "Dzuhur" },
    { time: jadwal.ashar, name: "Ashar" },
    { time: jadwal.maghrib, name: "Maghrib" },
    { time: jadwal.isya, name: "Isya" },
  ];

  prayerTimes.forEach((prayer) => scheduleTime(prayer.time, prayer.name));
};

const initializeSchedules = async (sock) => {
  try {
    const jadwalList = await Jadwal.find({});
    for (const item of jadwalList) {
      const jadwalBaru = await getNewSchedule(item.kota);
      if (jadwalBaru) {
        await setJadwalStatus(item.userId, item.kota, jadwalBaru);
        schedulePrayerTimes(jadwalBaru, sock, item.userId);
      }
    }
    console.log("All schedules have been reinitialized.");
  } catch (err) {
    console.error("Error initializing schedules:", err);
  }
};

const execute = async (sock, msg, args) => {
  const userId = msg.key.participant || msg.key.remoteJid;

  if (args.length === 0) {
    const jadwalStatus = await getJadwalStatus(userId);
    if (jadwalStatus) {
      await removeJadwalStatus(userId);
      await sock.sendMessage(userId, {
        text: "Anda sudah tidak menerima jadwal lagi!",
      });
    } else {
      sock.sendMessage(msg.key.remoteJid, {
        text: "Masukkan nama kota!, contoh: !ingatkansholat <nama_kota>",
      });
    }
    return;
  }

  const kota = listKota.find((k) =>
    k.lokasi.toLowerCase().includes(args[0].toLowerCase())
  );

  if (!kota) {
    await sock.sendMessage(userId, {
      text: "Kota tidak ditemukan, pastikan ejaan sudah benar.",
    });
    return;
  }

  try {
    const jadwal = await getNewSchedule(kota.id);
    if (jadwal) {
      await setJadwalStatus(userId, kota.id, jadwal);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `Anda sudah mendaftarkan jadwal sholat pada ${kota.lokasi}!`,
      });
      schedulePrayerTimes(jadwal, sock, userId);
    } else {
      throw new Error("Failed to fetch prayer schedule");
    }
  } catch (err) {
    console.error(err);
    sock.sendMessage(userId, {
      text: "Terjadi kesalahan saat mendapatkan data sholat",
    });
  }
};

const scheduleDailyJobs = async (sock) => {
  console.log("Menjadwalkan ulang tugas harian pada jam 01:00");
  await initializeSchedules(sock);
};

cron.schedule("0 1 * * *", () => scheduleDailyJobs(global.sock), {
  timezone: "Asia/Jakarta",
});

(async () => {
  await readListKota();
})();

module.exports = {
  name: "Ingatkan Jadwal Sholat",
  description: "Membantu anda ingatkan jadwal sholat pada kota anda",
  command: `${global.prefix[1]}ingatkansholat`,
  commandType: "plugin",
  isDependent: false,
  help: `Gunakan format ini: ${global.prefix[1]}ingatkansholat <nama_kota>`,
  execute,
  initializeSchedules,
};
