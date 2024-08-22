const axios = require("axios");

const url = "https://snapinst.com/api/ig/";
const execute = async (sock, msg, args) => {
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    Cookie:
      "uid=2f7dde932222d561; XSRF-TOKEN=eyJpdiI6InNveEg0WGdaNEs1aDhscDdjbXV6dFE9PSIsInZhbHVlIjoiYzkwcExISWI4dm9QeXJjdzNrTU8rMnpKY3A4K1k1Zno3WkxRcXlmbnhoZmswREdPWGFQY1cxbWlsZ2s2NjJKcGF5b3laVlN2d3l0eUxabGsyeUJ6SjRGaEdXb3RYNFk0YnE4Rnl3ZjFjUVdmOHB4dDJCeUdUaGs1aFkySXh1bW0iLCJtYWMiOiI2YWY4NDEzNDY0NGZjZTQyZDYwYmU2MzJmYjczMjQ5M2M1YzY0NzBhMzA3NmFmZDE4NmYzZjA4MGI5ZDZkOWE1MjA0In0%3D; snapinst_session=eyJpdiI6ImFRREhVOXMwVW5ic2lrNEhoMmRTWWc9PSIsInZhbHVlIjoiRVh6OHhBd3lwSGtaSGEzUkZWN1pucXh4eVJ3eTlMNDB1c1dcL3ZaNnhsdE01djFOb2NwYUIyWTR0VjZBNTlzcnhUMk5ibGZEa1hVRXQra2E2aytjK3NkQ3d2aStZWmh3WHdEaU9YQ2VBXC80UGI3VDdhRCtSRlk5blF6RzQ1WjFEdyIsIm1hYyI6IjU2OGExNTI3MGMxYTZjNWEzNWQ3YzIzOWQxOThmOWUwYTYzOTllNTM1ZmIxNTlhNTE1NmNlNTM3NDgyOGJmNDcifQ%3D%3D",
    Referer: "https://snapinst.com/id/instagram-story-download",
    "Sec-Ch-Ua":
      '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "X-Token": "null",
    "X-Xsrf-Token":
      "eyJpdiI6InNveEg0WGdaNEs1aDhscDdjbXV6dFE9PSIsInZhbHVlIjoiYzkwcExISWI4dm9QeXJjdzNrTU8rMnpKY3A4K1k1Zno3WkxRcXlmbnhoZmswREdPWGFQY1cxbWlsZ2s2NjJKcGF5b3laVlN2d3l0eUxabGsyeUJ6SjRGaEdXb3RYNFk0YnE4Rnl3ZjFjUVdmOHB4dDJCeUdUaGs1aFkySXh1bW0iLCJtYWMiOiI2YWY4NDEzNDY0NGZjZTQyZDYwYmU2MzJmYjczMjQ5M2M1YzY0NzBhMzA3NmFmZDE4NmYzZjA4MGI5ZDZkOWE1MjA0In0=",
  };
  const from = msg.key.remoteJid;
  try {
    if (args.length === 0) {
      sock.sendMessage(from, { text: "Mana Usernamenya??", quoted: msg });
    } else {
      const nama = args[0].includes("@") ? args[0].slice(1) : args[0];
      const req1 = await axios.get(url + "profile/" + nama, { headers });
      const res1 = await req1.data;
      if (res1.result.is_private === true) {
        sock.sendMessage(from, { text: "Akun private bos cari yang publik" });
      } else {
        sock.sendMessage(from, { text: "Tunggu Sebentar..."})
        const id = res1.result.id;
        const req2 = await axios.get(url + "stories/" + id, { headers });
        const res2 = await req2.data;
        if (res2.result.length === 0) {
          sock.sendMessage(from, { text: "Tidak Ada Story Yang Ditemukan" });
        } else {
          const promises = [];

          for (let i = 0; i < res2.result.length; i++) {
            if (!res2.result[i].has_audio) {
              const media = res2.result[i].image_versions2.candidates[0].url;

              promises.push(
                sock.sendMessage(from, {
                  image: { url: media },
                })
              );
            }

            if (res2.result[i].has_audio === true) {
              try {
                const url = res2.result[i].video_versions[0].url;
                const response = await axios.get(url, {
                  responseType: "stream",
                });
                const videoBuffer = await new Promise((resolve, reject) => {
                  const chunks = [];
                  response.data.on("data", (chunk) => chunks.push(chunk));
                  response.data.on("end", () => resolve(Buffer.concat(chunks)));
                  response.data.on("error", (error) => reject(error));
                });
                promises.push(
                  sock.sendMessage(from, {
                    video: videoBuffer,
                  })
                );
              } catch (error) {
                console.log(`Gagal mengunduh video: ${error.message}`);
              }
            }
          }

          await Promise.all(promises);
        }
      }
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      sock.sendMessage(from, {text:"Username tidak ditemukan"});
    } else {
      console.log("Kesalahan lain:", error.message);
    }
  }
};

module.exports = {
  name: "Instagram Stories Downloader",
  description: "Download Story Dari Instagram",
  command: "!igstory",
  commandType: "Downloader",
  isDependent: false,
  help: `ketik !igstory [username] untuk menggunakannya`,
  execute,
};
