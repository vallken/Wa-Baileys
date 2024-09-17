const fs = require("fs");
const path = require("path");
const waMessagePath = path.join(__dirname, "../python/", "logging.log");

const send_wa_message = async (sock, from) => {
  try {
    if (!fs.existsSync(waMessagePath)) {
      sock.sendMessage(from, { text: "Belum Ada Log" });
    }

    const message = fs.readFileSync(waMessagePath, "utf8").trim();

    if (message.length > 0) {
      await sock.sendMessage(from, { text: message });
    } else {
      await sock.sendMessage(from, {
        text: "Pesan kosong, tidak ada yang dikirim.",
      });
    }

    fs.writeFileSync(waMessagePath, ""); // Clear file setelah digunakan
  } catch (error) {
    console.error("Terjadi kesalahan saat membaca/kirim pesan:", error);
  }
};

const execute = async (sock, msg, _) => {
  const from = msg.key.remoteJid;

  await send_wa_message(sock, from);
};

module.exports = {
  name: "Notification",
  description: "Logger",
  command: "!log",
  commandType: "Admin",
  isDependent: false,
  help: ``,
  execute,
};
