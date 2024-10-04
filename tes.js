const axios = require('axios');

const proxyUrl = "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/all/data.json";

// Fungsi untuk mendapatkan daftar proxy dari API
async function getProxy() {
  try {
    const response = await axios.get(proxyUrl);
    const proxyList = response.data;

    // Cek jika proxyList ada
    if (!proxyList || proxyList.length === 0) {
      throw new Error("Tidak ada proxy tersedia.");
    }

    // Pilih salah satu proxy secara acak
    const randomProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    const proxyData = randomProxy.proxy;
    console.log("Proxy yang dipilih:", proxyData);
    return proxyData;
  } catch (error) {
    console.error("Error fetching proxy:", error);
    return null;
  }
}


getProxy()