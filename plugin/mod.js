const Admin = require("../lib/db/admin");

const formatNumber = (number) => {
  // Jika nomor dimulai dengan '08', ganti dengan '62'
  if (number.startsWith("08")) {
    number = "62" + number.slice(1);
  }

  // Tambahkan akhiran '@s.whatsapp.net' jika belum ada
  if (!number.endsWith("@s.whatsapp.net")) {
    number += "@s.whatsapp.net";
  }

  return number;
};

const execute = async (sock, msg, args) => {
  const from = msg.key.remoteJid;

  if (args.length === 0) {
    return sock.sendMessage(from, {
      text: "Usage:!admin <add|remove|list> <username>",
    });
  }

  if (args[0] === "list") {
    const admins = await Admin.find({});
    let teks = "Daftar Admin:\n";
    admins.forEach((admin, i) => {
      teks += `- ${admin.userId}\n`;
    });

    return sock.sendMessage(from, {
      text: teks,
    });
  }

  const userId = formatNumber(args[1]);
  if (args[0] === "add") {
    const admin = await Admin.findOne({ userId });
    if (admin) {
      return sock.sendMessage(from, {
        text: "User sudah ada dalam daftar admin!",
      });
    }
    const newAdmin = new Admin({ userId });
    await newAdmin.save();
    return sock.sendMessage(from, {
      text: "Berhasil menambahkan user ke daftar admin!",
    });
  } else if (args[0] === "remove") {
    await Admin.findOneAndDelete({ userId });
    return sock.sendMessage(from, {
      text: "Berhasil menghapus user dari daftar admin!",
    });
  } else {
    return sock.sendMessage(from, {
      text: "Usage:!admin <add|remove|list> <username>",
    });
  }
};

module.exports = {
  name: "Admin",
  description: "Kelola daftar admin WhatsApp",
  command: `${global.prefix[1]}mod`,
  commandType: "Admin",
  isDependent: false,
  help: `Gunakan ${global.prefix[1]}admin <add|remove|list> <username>`,
  execute,
};
