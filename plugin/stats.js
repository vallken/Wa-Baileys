const si = require("systeminformation");

async function getPerformanceStats() {
  try {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const disk = await si.fsSize();

    return {
      cpuUsage: cpu.currentLoad.toFixed(2),
      memoryUsage: (((mem.total - mem.available) / mem.total) * 100).toFixed(2),
      freeMemory: (mem.available / 1024 / 1024).toFixed(2), // MB
      totalMemory: (mem.total / 1024 / 1024).toFixed(2), // MB
      diskFree: (disk[0].available / 1024 / 1024 / 1024).toFixed(2), // GB
      diskTotal: (disk[0].size / 1024 / 1024 / 1024).toFixed(2), // GB
    };
  } catch (error) {
    console.error("Error getting performance stats:", error);
    return null;
  }
}

const execute = async (sock, msg) => {
  const stats = await getPerformanceStats();
  if (!stats) {
    return sock.sendMessage(msg.key.remoteJid, {
      text: "Error: Unable to retrieve performance stats.",
    });
  }
  const response = `*Performance Stats:*\nCPU Usage: ${stats.cpuUsage}%\nMemory Usage: ${stats.memoryUsage}%\nFree Memory: ${stats.freeMemory} MB\nTotal Memory: ${stats.totalMemory} MB\nFree Disk Space: ${stats.diskFree} GB\nTotal Disk Space: ${stats.diskTotal} GB`;
  sock.sendMessage(msg.key.remoteJid, { text: response });
};

module.exports = {
  name: "Performance Stats",
  description: "Melihat statistik performa sistem",
  command: `${global.prefix[1]}stats`,
  commandType: "Admin",
  isDependent: false,
  help: "Melihat statistik performa sistem.",
  execute,
};
