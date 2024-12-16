const Plugin = require("../lib/db/mtModel");
const config = require("../config");

const setMaintenance = async (pluginName, status) => {
  try {
    const plugin = await Plugin.findOneAndUpdate(
      { name: pluginName },
      { isMaintenance: status },
      { new: true, upsert: true }
    );
    return plugin;
  } catch (error) {
    throw new Error(`Gagal mengatur status maintenance: ${error.message}`);
  }
};

const isPluginInMaintenance = async (pluginName) => {
  try {
    const plugin = await Plugin.findOne({ name: pluginName });
    return plugin ? plugin.isMaintenance : false;
  } catch (error) {
    throw new Error(`Gagal mengecek status plugin: ${error.message}`);
  }
};

const listMaintenanceStatus = async () => {
  try {
    const plugins = await Plugin.find({});
    if (!plugins || plugins.length === 0) {
      return "Tidak ada plugin yang terdaftar.";
    }

    let statusList = "Status Maintenance Plugin:\n";
    plugins.forEach((plugin) => {
      statusList += `- ${plugin.name}: ${plugin.isMaintenance ? "ON" : "OFF"}\n`;
    });

    return statusList.trim();
  } catch (error) {
    throw new Error(`Gagal mendapatkan daftar plugin: ${error.message}`);
  }
};

const execute = async (sock, msg, args) => {
  const sender = msg.key.remoteJid;

  if (args.length < 1) {
    await sock.sendMessage(sender, {
      text: `Format salah! Gunakan: ${config.prefix[1]}maintenance <plugin> <on/off/list>`,
    });
    return;
  }

  const [command, action] = args;

  if (command === "list") {
    try {
      const statusMessage = await listMaintenanceStatus();
      await sock.sendMessage(sender, { text: statusMessage });
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `Terjadi kesalahan: ${error.message}`,
      });
    }
    return;
  }

  if (!["on", "off"].includes(action)) {
    await sock.sendMessage(sender, {
      text: "Aksi hanya bisa 'on', 'off', atau 'list'.",
    });
    return;
  }

  const isOn = action === "on";

  try {
    const updatedPlugin = await setMaintenance(command, isOn);

    await sock.sendMessage(sender, {
      text: `Plugin '${command}' telah diubah ke status maintenance: ${
        updatedPlugin.isMaintenance ? "ON" : "OFF"
      }.`,
    });
  } catch (error) {
    await sock.sendMessage(sender, {
      text: `Terjadi kesalahan: ${error.message}`,
    });
  }
};

module.exports = {
  commandType: "Admin",
  execute,
  isPluginInMaintenance,
};
