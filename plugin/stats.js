const si = require("systeminformation");

async function getPerformanceStats() {
  try {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const disk = await si.fsSize();

    return {
      cpuUsage: cpu.currentLoad.toFixed(2),
      memoryUsage: (((mem.total - mem.free) / mem.total) * 100).toFixed(2),
      freeMemory: (mem.free / 1024 / 1024).toFixed(2), // MB
      totalMemory: (mem.total / 1024 / 1024).toFixed(2), // MB
      diskFree: (disk[0].free / 1024 / 1024 / 1024).toFixed(2), // GB
      diskTotal: (disk[0].size / 1024 / 1024 / 1024).toFixed(2), // GB
    };
  } catch (error) {
    console.error("Error getting performance stats:", error);
    return null;
  }
}

const execute = async (sock, msg, args) => {
  const stats = await getPerformanceStats();
  const response = `*Performance Stats:*\nCPU Usage: ${stats.cpuUsage}%\nMemory Usage: ${stats.memoryUsage}%\nFree Memory: ${stats.freeMemory} MB\nTotal Memory: ${stats.totalMemory} MB\nFree Disk Space: ${stats.diskFree} GB\nTotal Disk Space: ${stats.diskTotal} GB`;
  sock.sendMessage(msg.key.remoteJid, {
    text: response,
    type: "extendedText",
  });
};

module.exports = {
    name: "Performance Stats",
    description: "Melihat statistik performa sistem",
    command: `${global.prefix[1]}stats`,
    commandType: "Admin",
    isDependent: false,
    help: "Melihat statistik performa sistem.",
    execute,
}
