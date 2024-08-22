const getInfo = require("../helper/tiktokStalk");

const getFlagEmoji = (countryCode) => {
  return countryCode
    .toUpperCase()
    .split("")
    .map((char) =>
      String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - "A".charCodeAt(0))
    )
    .join("");
};

const formatNumber = (num) => {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + " miliar";
  } else if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + " juta";
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + " ribu";
  } else {
    return num;
  }
};

const execute = async (sock, msg, args) => {
  const from = msg.key.remoteJid;
  try {
    if (!args[0]) {
      sock.sendMessage(from, { text: "Masukkan username TikTok!" });
    } else {
      const info = await getInfo.StalkUser(args[0]);
      if (info.status === "success") {
        const data = `📊 *User Info*:\n\n- 👤 Username: ${
          info.result.users.username
        }\n- 🎨 Nickname: ${info.result.users.nickname}\n- 📝 Signature: ${
          info.result.users.signature
        }\n- ✅ Verified: ${
          info.result.users.verified ? "Yes" : "No"
        }\n- 🔒 Private Account: ${
          info.result.users.privateAccount ? "Yes" : "No"
        }\n- 🌍 Region: ${getFlagEmoji(
          info.result.users.region
        )}\n\n📈 *User Stats*:\n\n- 👥 Followers: ${formatNumber(
          info.result.stats.followerCount
        )}\n- 🔗 Following: ${formatNumber(
          info.result.stats.followingCount
        )}\n- ❤️ Likes: ${formatNumber(
          info.result.stats.heartCount
        )}\n- 🎥 Videos: ${formatNumber(
          info.result.stats.videoCount
        )}\n- 🤝 Friends: ${formatNumber(info.result.stats.friendCount)}
        `;
        sock.sendMessage(from, {
            image: {url: info.result.users.avatarMedium},
            caption: data
        });
      }
    }
  } catch (e) {
    console.error(e);
    sock.sendMessage(from, { text: "Error: " + e.message });
  }
};


module.exports = {
    name: "Tiktok Profile Check",
    description: "Scraping Tiktok Profile",
    command: "!ttstalk",
    commandType: "Downloader",
    isDependent: false,
    help: `Gunakan !ttstalk <username>`,
    execute,
  };
