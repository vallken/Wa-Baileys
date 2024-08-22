const fs = require('fs');
const path = require('path');

const execute = async (sock, msg, args) => {
  const commandsPath = path.join(__dirname, './');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  let groupedCommands = {};

  // Mengelompokkan perintah berdasarkan commandType
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.name && command.description && command.command && command.commandType) {
      if (!groupedCommands[command.commandType]) {
        groupedCommands[command.commandType] = [];
      }
      groupedCommands[command.commandType].push(command);
    }
  }

  let helpMessage = "Daftar perintah yang tersedia:\n\n";

  // Menyusun pesan bantuan berdasarkan kelompok commandType
  for (const [commandType, commands] of Object.entries(groupedCommands)) {
    helpMessage += `=== ${commandType} ===\n`;
    commands.forEach(command => {
      helpMessage += `${command.command} - ${command.description}\n`;
    });
    helpMessage += '\n';
  }

  helpMessage += "Untuk informasi lebih lanjut tentang perintah tertentu, ketik: !help <nama_perintah>";

  await sock.sendMessage(msg.key.remoteJid, { text: helpMessage });
};

const executeSpecific = async (sock, msg, args) => {
  if (!args[0]) {
    return execute(sock, msg, args);
  }

  const commandName = args[0].toLowerCase();
  const commandsPath = path.join(__dirname, './');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.name.toLowerCase() === commandName || command.command.split(' ')[0].slice(1).toLowerCase() === commandName) {
      let helpMessage = `Nama: ${command.name}\n`;
      helpMessage += `Deskripsi: ${command.description}\n`;
      helpMessage += `Penggunaan: ${command.command}\n`;
      if (command.help) {
        helpMessage += `Bantuan tambahan: ${command.help}\n`;
      }

      await sock.sendMessage(msg.key.remoteJid, { text: helpMessage });
      return;
    }
  }

  await sock.sendMessage(msg.key.remoteJid, { text: "Perintah tidak ditemukan." });
};

module.exports = {
  name: "Help",
  description: "Menampilkan daftar perintah atau informasi tentang perintah tertentu",
  command: "!help [nama_perintah]",
  commandType: "Utility",
  isDependent: false,
  help: "Gunakan !help untuk melihat daftar semua perintah, atau !help <nama_perintah> untuk informasi detail tentang perintah tertentu.",
  execute: executeSpecific,
};
