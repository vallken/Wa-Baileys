const fs = require("fs");
const path = require("path");

// Define the path to the output file
const filePath = path.join(__dirname, "../python/", "output.txt");

const execute = async (sock, msg, args) => {
  const from = msg.key.remoteJid;

  try {
    // Check if the file exists before attempting to read it
    if (!fs.existsSync(filePath)) {
      return sock.sendMessage(from, { text: "File belum ada." });
    }

    // If the file exists, read its contents
    const data = fs.readFileSync(filePath, "utf8");

    // Send the contents of the file as a message
    if (data.trim().length > 0) {
      await sock.sendMessage(from, { text: data });
    } else {
      await sock.sendMessage(from, { text: "File kosong." });
    }
  } catch (error) {
    // Handle any errors during the file read process
    console.error("Error reading file:", error);
    await sock.sendMessage(from, { text: "Terjadi kesalahan saat membaca file." });
  }
};

module.exports = {
  name: "Admin",
  description: "Cek Gacha",
  command: `${global.prefix[1]}cek`,
  commandType: "Admin",
  isDependent: false,
  help: ``,
  execute,
};
