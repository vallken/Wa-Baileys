const Agenda = require("agenda");
require("dotenv").config();
const config = require("../config");

const agenda = new Agenda({
  db: { address: process.env.MONGO_URI, collection: "agenda" },
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

function processMentions(text) {
  const mentions = [];
  const matches = text.match(/@(\d+)/g) || [];

  for (const match of matches) {
    const number = match.replace("@", "").trim();
    const formattedNumber = `${number}@s.whatsapp.net`;
    mentions.push(formattedNumber);
  }
  return {
    text,
    mentions: mentions.length > 0 ? mentions : null,
  };
}

const getAgenda = async (from) => {
  try {
    const agendas = await agenda.jobs({
      name: "send reminder",
      "data.from": from,
    });
    return agendas;
  } catch (err) {
    console.error("Error getting agenda:", err);
    throw err;
  }
};

const addAgenda = async (from, sock, args, userId, msg) => {
  try {
    const timeIndex = args.findIndex(arg => /^\d+:\d+/.test(arg));
    const dateStr = args[1];
    const timeAndMsgParts = args.slice(timeIndex);

    const timeStr = timeAndMsgParts[0];
    const dateTimeStr = `${dateStr} ${timeStr}`;
    
    const mentions = args.filter(arg => arg.match(/^@\d+$/));
    
    const reminderMsg = timeAndMsgParts.slice(1)
      .filter(arg => !mentions.includes(arg))
      .join(" ");

    const dateTime = parseDateTime(dateTimeStr);

    const jobId = `reminder-${Date.now()}`;
    await agenda.schedule(dateTime, "send reminder", {
      userId,
      from,
      reminderMsg,
      jobId,
    });

    const responseText = `Pengingat dijadwalkan untuk ${
      mentions.length > 0 ? mentions.join(' ') + ' ' : ''
    }${reminderMsg} pada ${dateTimeStr}`;

    await sock.sendMessage(
      from,
      { text: responseText },
      { quoted: msg }
    );
  } catch (error) {
    console.error("Gagal menjadwalkan pengingat:", error.message);
    await sock.sendMessage(from, {
      text: `Gagal menjadwalkan pengingat: ${error.message}`,
    });
  }
};

const removeAgenda = async (from, sock, taskIndex) => {
  try {
    const agendas = await getAgenda(from);
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
    const reminders = await getAgenda(from);
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
      await addAgenda(from, sock, args, userId, msg);
    }
  } else if (args[0] === "remove") {
    if (!args[1]) {
      await sock.sendMessage(from, {
        text: "Masukkan nomor tugas yang ingin dihapus",
      });
    } else {
      const taskIndex = parseInt(args[1], 10) - 1;
      await removeAgenda(from, sock, taskIndex);
    }
  } else {
    await sock.sendMessage(from, {
      text:
        `${config.prefix[1]}remind [list|add|remove]\n` +
        "- list: Menampilkan daftar pengingat\n" +
        `- add: ${config.prefix[1]}remind add dd/mm/yyyy jam:menit pesan\n` +
        `- remove: ${config.prefix[1]}remind remove [nomor_tugas]`,
    });
  }
};

const initializeSchedules = async function (sock) {
  await agenda.start();
  console.log("Agenda is ready");
  agenda.define("send reminder", async (job) => {
    const { from, userId, reminderMsg } = job.attrs.data;
    const msgContent = processMentions(reminderMsg);
    const mentions = userId.replace("@s.whatsapp.net", "");

    const message = from.includes("@g.us")
      ? {
          text: `*Pengingat:*\n\n ${
            msgContent.mentions
              ? msgContent.text
              : `${msgContent.text} @${mentions}`
          }.`,
          mentions: msgContent.mentions ? [msgContent.mentions] : [userId],
        }
      : { text: `*Pengingat: ${reminderMsg}. Jangan lupa!*` };

    await sock.sendMessage(from, message);
    await job.remove();
  });
};

module.exports = {
  name: "Pengingat",
  description: "Menjadwalkan dan mengirim pesan pengingat",
  command: `${config.prefix[1]}remind`,
  commandType: "Utility",
  isDependent: false,
  help:
    `${config.prefix[1]}remind [list|add|remove]\n` +
    "- list: Menampilkan daftar pengingat\n" +
    `- add: ${config.prefix[1]}remind add dd/mm/yyyy jam:menit pesan\n` +
    `- remove: ${config.prefix[1]}remind remove [nomor_tugas]`,
  execute,
  initializeSchedules,
};
