  const Agenda = require("agenda");
  require("dotenv").config();
  const jadwalPlugin = require("./ingatkansholat");

  const agenda = new Agenda({
    db: { address: process.env.MONGO_URI, collection: 'agenda' },
    
  });

  function parseDateTime(dateTimeStr) {
    const [datePart, timePart] = dateTimeStr.split(" ");
    const [day, month, year] = datePart.split("/");
    const [hours, minutes] = timePart.split(":");

    const date = new Date(year, month - 1, day, hours, minutes);

    if (isNaN(date.getTime())) {
      throw new Error(
        "Format waktu tidak valid. Gunakan format dd/mm/yyyy jam:menit"
      );
    }

    return date;
  }

  const getAgenda = async (userId) => {
    try {
      const agendas = await agenda.jobs({
        name: "send reminder",
        "data.userId": userId,
      });
      return agendas;
    } catch (err) {
      console.error("Error getting agenda:", err);
      throw err;
    }
  };

  const addAgenda = async (from, sock, userId, args) => {
    try {
      const dateTimeStr = `${args[1]} ${args[2]}`;
      const reminderMsg = args.slice(3).join(" ");
      const dateTime = parseDateTime(dateTimeStr);

      const jobId = `reminder-${Date.now()}`;
      await agenda.schedule(dateTime, "send reminder", {
        userId,
        reminderMsg,
        jobId,
      });
      await sock.sendMessage(from, {
        text: `Pengingat dijadwalkan untuk ${reminderMsg} pada ${dateTimeStr}`,
      });
    } catch (error) {
      console.error("Gagal menjadwalkan pengingat:", error.message);
      await sock.sendMessage(from, {
        text: `Gagal menjadwalkan pengingat: ${error.message}`,
      });
    }
  };

  const removeAgenda = async (from, sock, userId, taskIndex) => {
    try {
      const agendas = await getAgenda(userId);
      if (taskIndex >= agendas.length || taskIndex < 0) {
        throw new Error("Nomor tugas tidak valid");
      }
      const taskToRemove = agendas[taskIndex];
      await agenda.cancel({ _id: taskToRemove.attrs._id });
      await sock.sendMessage(from, {
        text: `Pengingat "${taskToRemove.attrs.data.reminderMsg}" telah dihapus.`,
      });
    } catch (error) {
      console.error("Gagal menghapus pengingat:", error.message);
      await sock.sendMessage(from, {
        text: `Gagal menghapus pengingat: ${error.message}`,
      });
    }
  };

  const execute = async (sock, msg, args) => {
    const from = msg.key.remoteJid;
    const userId = msg.key.participant ? msg.key.participant : msg.key.remoteJid;

    if (args[0] === "list") {
      const reminders = await getAgenda(userId);
      if (reminders.length > 0) {
        let response = "Daftar pengingat:\n";
        reminders.forEach((reminder, index) => {
          const { data, nextRunAt } = reminder.attrs;
          response += `${index + 1}. ${
            data.reminderMsg
          } (${nextRunAt.toLocaleString()})\n`;
        });
        await sock.sendMessage(from, { text: response });
      } else {
        await sock.sendMessage(from, { text: "Tidak ada pengingat" });
      }
    } else if (args[0] === "add") {
      if (args.length < 4) {
        await sock.sendMessage(from, {
          text: "Format tidak valid. Gunakan: !remind add dd/mm/yyyy jam:menit pesan",
        });
      } else {
        await addAgenda(from, sock, userId, args);
      }
    } else if (args[0] === "remove") {
      if (!args[1]) {
        await sock.sendMessage(from, {
          text: "Masukkan nomor tugas yang ingin dihapus",
        });
      } else {
        const taskIndex = parseInt(args[1], 10) - 1;
        await removeAgenda(from, sock, userId, taskIndex);
      }
    } else {
      await sock.sendMessage(from, {
        text: "Perintah tidak valid. Gunakan: !remind [list|add|remove]",
      });
    }
  };

  agenda.define('daily reminder', async () => {
    await jadwalPlugin.initializeSchedules()
    console.log('daily reminder');
  })

  async function scheduleDailyJobs() {
    console.log("Scheduling daily jobs...");
    await agenda.every("0 1 * * *",{
      timezone: "Asia/Jakarta",
      name: "daily reminder",
    });
  }

  const initializeSchedules = async function (sock) {
    await agenda.start();
    await scheduleDailyJobs()
    console.log("Agenda is ready");
    agenda.define("send reminder", async (job) => {
      const { userId, reminderMsg } = job.attrs.data;
      console.log(`Sending reminder to ${userId}: ${reminderMsg}`);
      await sock.sendMessage(userId, {
        text: `Pengingat: ${reminderMsg}. Jangan lupa!`,
      });
      await job.remove();
    });
  };

  module.exports = {
    name: "Pengingat",
    description: "Menjadwalkan dan mengirim pesan pengingat",
    command: "!remind",
    commandType: "Utility",
    isDependent: false,
    help:
      "!remind [list|add|remove]\n" +
      "- list: Menampilkan daftar pengingat\n" +
      "- add: !remind add dd/mm/yyyy jam:menit pesan\n" +
      "- remove: !remind remove [nomor_tugas]",
    execute,
    initializeSchedules,
  };
