const mongoose = require("mongoose");
const config = require('../config'); 

const walletSchema = new mongoose.Schema({
  public_key: String,
  private_key: String,
  balance: Number,
  discovered_at: Date,
});
const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);

const execute = async (sock, msg, args) => {
  const from = msg.key.remoteJid;

  try {

    // Query the wallets collection
    const wallets = await Wallet.find({}).sort({ discovered_at: -1 }).limit(10); // Get the latest 10 wallets

    if (wallets.length > 0) {
      // Format the data into a readable string
      const formattedData = wallets.map(wallet => (
        `Public Key: ${wallet.public_key}\nPrivate Key: ${wallet.private_key}\nBalance: ${wallet.balance.toFixed(9)} SOL\nDiscovered At: ${wallet.discovered_at}\n---`
      )).join("\n\n");

      // Send the formatted data as a message
      await sock.sendMessage(from, { text: formattedData });
    } else {
      await sock.sendMessage(from, { text: "Tidak ada data wallet di database." });
    }
  } catch (error) {
    // Handle any errors during the database operation
    console.error("Error fetching data from MongoDB:", error);
    await sock.sendMessage(from, { text: "Terjadi kesalahan saat mengambil data dari MongoDB." });
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
  }
};

module.exports = {
  name: "Admin",
  description: "Cek Gacha 2",
  command: `${config.prefix[1]}sol`,
  commandType: "Admin",
  isDependent: false,
  help: ``,
  execute,
};
