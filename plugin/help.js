const fs = require("fs");
const path = require("path");
const config = require('../config');

const execute = async (sock, msg, args) => {
  try {
    const commandsPath = path.join(__dirname, "./");
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js") && file !== path.basename(__filename));

    let groupedCommands = {};

    // Mengelompokkan perintah berdasarkan commandType
    for (const file of commandFiles) {
      try {
        // Hapus cache untuk memastikan pembacaan ulang modul
        delete require.cache[require.resolve(path.join(commandsPath, file))];
        
        const command = require(path.join(commandsPath, file));
        
        // Validasi struktur perintah
        if (
          command.name && 
          command.description && 
          command.command && 
          command.commandType
        ) {
          if (!groupedCommands[command.commandType]) {
            groupedCommands[command.commandType] = [];
          }
          groupedCommands[command.commandType].push(command);
        }
      } catch (cmdError) {
        console.error(`Error loading command from ${file}:`, cmdError);
      }
    }

    let helpMessage = "📋 *Daftar Perintah yang Tersedia:*\n\n";

    // Menyusun pesan bantuan berdasarkan kelompok commandType
    for (const [commandType, commands] of Object.entries(groupedCommands)) {
      helpMessage += `*=== ${commandType.toUpperCase()} ===*\n`;
      commands.forEach((command) => {
        helpMessage += `• *${command.command}* - ${command.description}\n`;
      });
      helpMessage += "\n";
    }

    helpMessage += `_Untuk informasi detail tentang perintah, ketik:_\n*${config.prefix[1]}help <nama_perintah>*`;

    await sock.sendMessage(msg.key.remoteJid, { 
      text: helpMessage,
      mentions: [msg.key.participant] // Tambahkan mention untuk interaktivitas
    });
  } catch (error) {
    console.error("Error in help command:", error);
    await sock.sendMessage(msg.key.remoteJid, { 
      text: "Maaf, terjadi kesalahan saat memuat daftar perintah."
    });
  }
};

const executeSpecific = async (sock, msg, args) => {
  try {
    // Jika tidak ada argumen, tampilkan daftar umum
    if (!args[0]) {
      return execute(sock, msg, args);
    }

    const commandName = args[0].toLowerCase();
    const commandsPath = path.join(__dirname, "./");
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js") && file !== path.basename(__filename));

    for (const file of commandFiles) {
      try {
        // Hapus cache untuk memastikan pembacaan ulang modul
        delete require.cache[require.resolve(path.join(commandsPath, file))];
        
        const command = require(path.join(commandsPath, file));
        
        // Berbagai metode pencocokan nama perintah
        const matchConditions = [
          command.name && command.name.toLowerCase() === commandName,
          command.command && command.command.toLowerCase().includes(commandName),
          command.name && command.name.toLowerCase().includes(commandName)
        ];

        if (matchConditions.some(condition => condition)) {
          let helpMessage = `📌 *Informasi Perintah*\n\n`;
          helpMessage += `*Nama:* ${command.name}\n`;
          helpMessage += `*Deskripsi:* ${command.description}\n`;
          helpMessage += `*Penggunaan:* ${command.command}\n`;
          
          if (command.commandType) {
            helpMessage += `*Tipe:* ${command.commandType}\n`;
          }
          
          if (command.help) {
            helpMessage += `\n*Bantuan Tambahan:*\n${command.help}\n`;
          }

          await sock.sendMessage(msg.key.remoteJid, { 
            text: helpMessage,
            mentions: [msg.key.participant] 
          });
          return;
        }
      } catch (cmdError) {
        console.error(`Error processing command from ${file}:`, cmdError);
      }
    }

    // Jika tidak menemukan perintah
    await sock.sendMessage(msg.key.remoteJid, {
      text: `Perintah *${commandName}* tidak ditemukan. Gunakan ${config.prefix[1]}help untuk melihat daftar perintah.`
    });
  } catch (error) {
    console.error("Error in specific help command:", error);
    await sock.sendMessage(msg.key.remoteJid, { 
      text: "Maaf, terjadi kesalahan saat mencari informasi perintah."
    });
  }
};

module.exports = {
  name: "Help",
  description: "Menampilkan daftar perintah atau informasi detail tentang perintah tertentu",
  command: `${config.prefix[1]}help [nama perintah]`,
  commandType: "Utility",
  execute: executeSpecific,
  help: `Gunakan ${config.prefix[1]}help untuk melihat semua perintah, atau ${config.prefix[1]}help <nama_perintah> untuk detail spesifik.`
};