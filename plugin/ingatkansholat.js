const axios = require("axios");
const cron = require("node-cron");
const fs = require("fs").promises;
const path = require("path");
const Jadwal = require("../lib/db/jadwal");
const config = require('../config');

const filePath = path.resolve(__dirname, "..", "helper", "listKota.json");
const prayerPath = path.resolve(__dirname, "..", "helper", "prayerMsg.json");

let listKota;
let scheduleJobs = {};

class JadwalHandler {
  constructor(sock) {
    this.sock = sock;
  }

  async readListKota() {
    try {
      const fileContent = await fs.readFile(filePath, "utf8");
      listKota = JSON.parse(fileContent);
    } catch (error) {
      console.error("Error reading listKota.json:", error);
      listKota = [];
    }
  }

  getFormattedDate() {
    const today = new Date();
    return today.toISOString().split("T")[0];
  }

  async setJadwalStatus(userId, kota, jadwal) {
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
  }

  async getJadwalStatus(userId) {
    try {
      return await Jadwal.findOne({ userId });
    } catch (err) {
      console.error("Error getting jadwal status:", err);
      return null;
    }
  }

  async removeJadwalStatus(userId) {
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
  }

  async getNewSchedule(id) {
    const url = `https://api.myquran.com/v2/sholat/jadwal/${id}/${this.getFormattedDate()}`;
    try {
      const response = await axios.get(url);
      return response.data.data.jadwal;
    } catch (err) {
      console.error("Error fetching new schedule:", err);
      return null;
    }
  }

  async sendMessage(userId, time, prayerName) {
    try {
      const data = await fs.readFile(prayerPath, "utf8");
      const messages = JSON.parse(data);

      const prayerMessages = messages[prayerName] || messages["Default"];

      let message =
        `Waktu sholat ${prayerName} telah tiba pada ${time} WIB. \n\n` +
        prayerMessages[Math.floor(Math.random() * prayerMessages.length)];

      this.sock.sendMessage(userId, { text: message });
    } catch (error) {
      console.error("Error reading prayer messages:", error);
    }
  }

  schedulePrayerTimes(jadwal, userId) {
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
          this.sendMessage(userId, time, prayerName);
        },
        {
          timezone: "Asia/Jakarta",
        }
      );
      scheduleJobs[userId].push(job);
    };

    const prayerTimes = [
      { time: jadwal.subuh, name: "Subuh" },
      { time: jadwal.dhuha, name: "Dhuha" },
      { time: jadwal.dzuhur, name: "Dzuhur" },
      { time: jadwal.ashar, name: "Ashar" },
      { time: jadwal.maghrib, name: "Maghrib" },
      { time: jadwal.isya, name: "Isya" },
    ];

    prayerTimes.forEach((prayer) => scheduleTime(prayer.time, prayer.name));
  }

  async initializeSchedules() {
    try {
      const jadwalList = await Jadwal.find({});
      for (const item of jadwalList) {
        const jadwalBaru = await this.getNewSchedule(item.kota);
        if (jadwalBaru) {
          await this.setJadwalStatus(item.userId, item.kota, jadwalBaru);
          this.schedulePrayerTimes(jadwalBaru, item.userId);
        }
      }
      console.log("All schedules have been reinitialized.");
    } catch (err) {
      console.error("Error initializing schedules:", err);
    }
  }
}

const execute = async (sock, msg, args) => {
  const userId = msg.key.participant || msg.key.remoteJid;
  const jadwalHandler = new JadwalHandler(sock);

  if (args.length === 0) {
    const jadwalStatus = await jadwalHandler.getJadwalStatus(userId);
    if (jadwalStatus) {
      await jadwalHandler.removeJadwalStatus(userId);
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
    const jadwal = await jadwalHandler.getNewSchedule(kota.id);
    if (jadwal) {
      await jadwalHandler.setJadwalStatus(userId, kota.id, jadwal);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `Anda sudah mendaftarkan jadwal sholat pada ${kota.lokasi}!`,
      });
      jadwalHandler.schedulePrayerTimes(jadwal, userId);
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
  await new JadwalHandler(sock).initializeSchedules();
};

cron.schedule("0 1 * * *", () => scheduleDailyJobs(global.sock), {
  timezone: "Asia/Jakarta",
});

(async () => {
  const jadwalHandler = new JadwalHandler(global.sock);
  await jadwalHandler.readListKota();
})();

module.exports = {
  name: "Ingatkan Jadwal Sholat",
  description: "Membantu anda ingatkan jadwal sholat pada kota anda",
  command: `${config.prefix[1]}ingatkansholat`,
  commandType: "plugin",
  isDependent: false,
  help: `Gunakan format ini: ${config.prefix[1]}ingatkansholat <nama_kota>`,
  execute,
  initializeSchedules: new JadwalHandler().initializeSchedules,
};
