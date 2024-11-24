const Alias = require("../lib/db/alias");
const config = require('../config');

// Constants
const COMMANDS = {
  ADD: 'add',
  REMOVE: 'remove',
  LIST: 'list',
  SEARCH: 'search'
};

// Helper Functions
function formatAliasList(aliases) {
  if (aliases.length === 0) {
    return "Tidak ada alias yang tersimpan.";
  }
  
  return aliases
    .map((alias, index) => 
      `${index + 1}. ${alias.command} => ${alias.response}`)
    .join('\n');
}

function formatDate(date) {
  return new Date(date).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

// Function to process mentions in message
function processMentions(text) {
  const mentions = [];
  const matches = text.match(/@(\d+)/g) || []; 

  for (const match of matches) {
    const number = match.replace('@', '').trim(); 
    const formattedNumber = `${number}@s.whatsapp.net`;
    mentions.push(formattedNumber);
  }
  return {
    text,
    mentions: mentions.length > 0 ? mentions : null,
  };
}


// Command Handlers
async function handleAddAlias(sock, sender, command, response, createdBy) {
  if (!command || !response) {
    await sock.sendMessage(sender, {
      text: `Format salah! Gunakan: ${config.prefix[1]}alias add <command> <response>`
    });
    return;
  }

  try {
    const processedResponse = processMentions(response);

    const existingAlias = await Alias.findOne({ command });
    if (existingAlias) {
      existingAlias.response = processedResponse.text; 
      existingAlias.updatedAt = Date.now();
      await existingAlias.save();

      await sock.sendMessage(sender, {
        text: `✅ Alias '${command}' diperbarui:\nResponse: ${processedResponse.text}`
      });
    } else {
      // Create new alias
      const newAlias = new Alias({
        command,
        response: processedResponse.text, 
        createdBy
      });
      await newAlias.save();

      await sock.sendMessage(sender, {
        text: `✅ Alias baru ditambahkan:\nCommand: ${command}\nResponse: ${processedResponse.text}`
      });
    }
  } catch (error) {
    console.error("Error adding alias:", error);
    await sock.sendMessage(sender, {
      text: `❌ Gagal menambahkan alias: ${error.message}`
    });
  }
}


async function handleExecuteAlias(sock, sender, command, additionalArgs = []) {
  try {
    const alias = await Alias.findOne({ command });
    
    if (!alias) {
      await sock.sendMessage(sender, {
        text: `❌ Alias '${command}' tidak ditemukan.\nGunakan ,alias list untuk melihat daftar alias yang tersedia.`
      });
      return;
    }

    let response = alias.response;
    
    // Handle placeholders
    response = response.replace(/\{(\d+)\}/g, (match, number) => {
      const argIndex = parseInt(number) - 1;
      return additionalArgs[argIndex] || match;
    });

    response = response.replace('{all}', additionalArgs.join(' '));

    const messageContent = processMentions(response);
    console.log(messageContent.mentions)

    await sock.sendMessage(sender, {
      text: messageContent.text,
      mentions: messageContent.mentions
    });
  } catch (error) {
    console.error("Error executing alias:", error);
    await sock.sendMessage(sender, {
      text: `❌ Gagal menjalankan alias: ${error.message}`
    });
  }
}


async function checkAndExecuteAlias(sock, msg, text) {
  try {
    const parts = text.split(' ');
    const potentialAlias = parts[0].toLowerCase();
    const args = parts.slice(1);

    const alias = await Alias.findOne({ command: potentialAlias });

    if (alias) {
      let response = alias.response;
      response = response.replace(/\{(\d+)\}/g, (match, number) => {
        const argIndex = parseInt(number) - 1;
        return args[argIndex] || match;
      });
      response = response.replace('{all}', args.join(' '));
      console.log("Response after placeholder replacement:", response);
      const messageContent = processMentions(response);
      try {
        await sock.sendMessage(msg.key.remoteJid, {
          text: messageContent.text,
          mentions: messageContent.mentions
        });
        console.log("Message sent successfully");
      } catch (sendError) {
        console.error("Error sending message:", sendError);
      }

      return true;
    }
    return false;
  } catch (error) {
    console.error("Error executing alias:", error);
    return false;
  }
}

async function handleRemoveAlias(sock, sender, command) {
  if (!command) {
    await sock.sendMessage(sender, {
      text: "Format salah! Gunakan: ,alias remove <command>"
    });
    return;
  }

  try {
    const deletedAlias = await Alias.findOneAndDelete({ command });
    
    if (!deletedAlias) {
      await sock.sendMessage(sender, {
        text: `❌ Alias '${command}' tidak ditemukan.`
      });
      return;
    }

    await sock.sendMessage(sender, {
      text: `✅ Alias '${command}' dengan respons '${deletedAlias.response}' berhasil dihapus.`
    });
  } catch (error) {
    console.error("Error removing alias:", error);
    await sock.sendMessage(sender, {
      text: `❌ Gagal menghapus alias: ${error.message}`
    });
  }
}

async function handleListAliases(sock, sender, page = 1) {
  try {
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const totalAliases = await Alias.countDocuments();
    const totalPages = Math.ceil(totalAliases / limit);
    
    const aliases = await Alias.find()
      .sort({ command: 1 })
      .skip(skip)
      .limit(limit);

    const aliasList = formatAliasList(aliases);
    const paginationInfo = `\nHalaman ${page} dari ${totalPages} (Total: ${totalAliases} alias)`;
    const navigationHelp = `\nGunakan '${config.prefix[1]}alias list <nomor_halaman>' untuk melihat halaman lain`;

    await sock.sendMessage(sender, {
      text: `📝 Daftar Alias:${totalAliases === 0 ? '\nTidak ada alias yang tersimpan.' : '\n\n' + aliasList}${paginationInfo}${navigationHelp}`
    });
  } catch (error) {
    console.error("Error listing aliases:", error);
    await sock.sendMessage(sender, {
      text: `❌ Gagal mengambil daftar alias: ${error.message}`
    });
  }
}

async function handleSearchAlias(sock, sender, query) {
  if (!query) {
    await sock.sendMessage(sender, {
      text: `Format salah! Gunakan: ${config.prefix[1]}alias search <kata_kunci>`
    });
    return;
  }

  try {
    const aliases = await Alias.find({
      $or: [
        { command: { $regex: query, $options: 'i' } },
        { response: { $regex: query, $options: 'i' } }
      ]
    }).limit(10);

    if (aliases.length === 0) {
      await sock.sendMessage(sender, {
        text: `❌ Tidak ditemukan alias yang mengandung kata kunci '${query}'`
      });
      return;
    }

    const searchResults = aliases.map((alias, index) => 
      `${index + 1}. ${alias.command}\n   Response: ${alias.response}\n   Dibuat: ${formatDate(alias.createdAt)}`
    ).join('\n\n');

    await sock.sendMessage(sender, {
      text: `🔍 Hasil pencarian untuk '${query}':\n\n${searchResults}`
    });
  } catch (error) {
    console.error("Error searching aliases:", error);
    await sock.sendMessage(sender, {
      text: `❌ Gagal mencari alias: ${error.message}`
    });
  }
}

async function handleExecuteAlias(sock, sender, command) {
  try {
    const alias = await Alias.findOne({ command });
    
    if (!alias) {
      await sock.sendMessage(sender, {
        text: `❌ Alias '${command}' tidak ditemukan.\nGunakan ,alias list untuk melihat daftar alias yang tersedia.`
      });
      return;
    }

    await sock.sendMessage(sender, {
      text: alias.response
    });
  } catch (error) {
    console.error("Error executing alias:", error);
    await sock.sendMessage(sender, {
      text: `❌ Gagal menjalankan alias: ${error.message}`
    });
  }
}

// Main Execute Function
const execute = async (sock, msg, args) => {
  try {
    const sender = msg.key.remoteJid;
    const userId = msg.key.participant || sender;

    if (args.length === 0) {
      await sock.sendMessage(sender, {
        text: `📋 Panduan penggunaan alias:
1. Tambah/Update: ${config.prefix[1]}alias add <command> <response>
2. Hapus: ${config.prefix[1]}alias remove <command>
3. Lihat daftar: ${config.prefix[1]}alias list [halaman]
4. Cari: ${config.prefix[1]}alias search <kata_kunci>
5. Gunakan: ${config.prefix[1]}<command>`
      });
      return;
    }

    const operation = args[0].toLowerCase();

    switch (operation) {
      case COMMANDS.ADD:
        const [_, command, ...responseParts] = args;
        await handleAddAlias(sock, sender, command, responseParts.join(" "), userId);
        break;

      case COMMANDS.REMOVE:
        await handleRemoveAlias(sock, sender, args[1]);
        break;

      case COMMANDS.LIST:
        const page = parseInt(args[1]) || 1;
        await handleListAliases(sock, sender, page);
        break;

      case COMMANDS.SEARCH:
        const query = args.slice(1).join(" ");
        await handleSearchAlias(sock, sender, query);
        break;

      default:
        await handleExecuteAlias(sock, sender, operation);
        break;
    }
  } catch (error) {
    console.error("Error in alias command:", error);
    await sock.sendMessage(msg.key.remoteJid, {
      text: "❌ Terjadi kesalahan saat memproses perintah alias."
    });
  }
};
module.exports = {
  commandType: "Utility",
  execute,
  checkAndExecuteAlias,
  description: "Membuat, menghapus, dan menggunakan alias untuk perintah custom dengan dukungan mention",
  help: `
1. ${config.prefix[1]}alias add <command> <response> - Menambah/update alias (bisa include @mention)
2. ${config.prefix[1]}alias remove <command> - Menghapus alias
3. ${config.prefix[1]}alias list [halaman] - Melihat daftar alias
4. ${config.prefix[1]}alias search <kata_kunci> - Mencari alias
5. <command> - Menggunakan alias`,
  command: `${config.prefix[1]}alias`,
};