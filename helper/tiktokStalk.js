const axios = require("axios");
const qs = require("qs");
const cheerio = require("cheerio");
const crypto = require("crypto");
const HttpsProxyAgent = require("https-proxy-agent");
const SocksProxyAgent = require("socks-proxy-agent");

const _userPostsParams = () => {
  return (
    qs.stringify({
      aid: 1988,
      app_language: "en",
      app_name: "tiktok_web",
      battery_info: 1,
      browser_language: "en-US",
      browser_name: "Mozilla",
      browser_online: true,
      browser_platform: "Win32",
      browser_version:
        "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.35",
      channel: "tiktok_web",
      cookie_enabled: true,
      device_id: "7002566096994190854",
      device_platform: "web_pc",
      focus_state: false,
      from_page: "user",
      history_len: 3,
      is_fullscreen: false,
      is_page_visible: true,
      os: "windows",
      priority_region: "RO",
      referer: "https://exportcomments.com/",
      region: "RO",
      root_referer: "https://exportcomments.com/",
      screen_height: 1440,
      screen_width: 2560,
      tz_name: "Europe/Bucharest",
      verifyFp: "verify_lacphy8d_z2ux9idt_xdmu_4gKb_9nng_NNTTTvsFS8ao",
      webcast_language: "en",
    }) +
    "&msToken=7UfjxOYL5mVC8QFOKQRhmLR3pCjoxewuwxtfFIcPweqC05Q6C_qjW-5Ba6_fE5-fkZc0wkLSWaaesA4CZ0LAqRrXSL8b88jGvEjbZPwLIPnHeyQq6VifzyKf5oGCQNw_W4Xq12Q-8KCuyiKGLOw=&X-Bogus=DFSzswVL-XGANHVWS0OnS2XyYJUm"
  );
};

const _xttParams = (secUid, cursor, count) => {
  return qs.stringify({
    aid: "1988",
    cookie_enabled: true,
    screen_width: 0,
    screen_height: 0,
    browser_language: "",
    browser_platform: "",
    browser_name: "",
    browser_version: "",
    browser_online: "",
    timezone_name: "Europe/London",
    secUid,
    cursor,
    count,
    is_encryption: 1,
  });
};

const StalkUser = (username, cookie, postLimit, proxy) =>
  new Promise(async (resolve) => {
    username = username.replace("@", "");
    axios.get(`https://www.tiktok.com/@${username}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36",
          cookie:
            typeof cookie === "object"
              ? cookie.map((v) => `${v.name}=${v.value}`).join("; ")
              : cookie,
        },
        httpsAgent:
          (proxy &&
            (proxy.startsWith("http") || proxy.startsWith("https")
              ? new HttpsProxyAgent(proxy)
              : proxy.startsWith("socks")
              ? new SocksProxyAgent(proxy)
              : undefined)) ||
          undefined,
      })
      .then(async ({ data }) => {
        const $ = cheerio.load(data);
        const result = JSON.parse(
          $("script#__UNIVERSAL_DATA_FOR_REHYDRATION__").text()
        );
        if (
          !result["__DEFAULT_SCOPE__"] ||
          !result["__DEFAULT_SCOPE__"]["webapp.user-detail"]
        ) {
          return resolve({
            status: "error",
            message: "User not found!",
          });
        }
        const dataUser =
          result["__DEFAULT_SCOPE__"]["webapp.user-detail"]["userInfo"];
        const posts = await parsePosts(dataUser, postLimit, proxy);
        const { users, stats } = parseDataUser(dataUser, posts);
        resolve({
          status: "success",
          result: {
            users,
            stats,
            posts,
          },
        });
      })
      .catch((e) => resolve({ status: "error", message: e.message }));
  });

exports.StalkUser = StalkUser;

const request = async (secUid, cursor = 0, count = 30, proxy) => {
  const { data } = await axios.get(
    `https://www.tiktok.com/api/post/item_list/?${_userPostsParams()}`,
    {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.35",
        "X-tt-params": xttparams(_xttParams(secUid, cursor, count)),
      },
      httpsAgent:
        (proxy &&
          (proxy.startsWith("http") || proxy.startsWith("https")
            ? new HttpsProxyAgent(proxy)
            : proxy.startsWith("socks")
            ? new SocksProxyAgent(proxy)
            : undefined)) ||
        undefined,
    }
  );
  return data;
};

const parseDataUser = (dataUser, posts) => {
  const users = {
    id: dataUser.user.id,
    username: dataUser.user.uniqueId,
    nickname: dataUser.user.nickname,
    avatarLarger: dataUser.user.avatarLarger,
    avatarThumb: dataUser.user.avatarThumb,
    avatarMedium: dataUser.user.avatarMedium,
    signature: dataUser.user.signature,
    verified: dataUser.user.verified,
    privateAccount: dataUser.user.privateAccount,
    region: dataUser.user.region,
    commerceUser: dataUser.user.commerceUserInfo.commerceUser,
    usernameModifyTime: dataUser.user.uniqueIdModifyTime,
    nicknameModifyTime: dataUser.user.nickNameModifyTime,
  };
  const stats = {
    followerCount: dataUser.stats.followerCount,
    followingCount: dataUser.stats.followingCount,
    heartCount: dataUser.stats.heartCount,
    videoCount: dataUser.stats.videoCount,
    likeCount: dataUser.stats.diggCount,
    friendCount: dataUser.stats.friendCount,
    postCount: posts.length,
  };
  return { users, stats };
};

const parsePosts = async (dataUser, postLimit, proxy) => {
  let hasMore = true;
  let cursor = null;
  const posts = [];
  while (hasMore) {
    let result2 = null;
    let counter = 0;
    for (let i = 0; i < 30; i++) {
      result2 = await request(dataUser.user.secUid, cursor, 30, proxy);
      if (result2 !== "") break;
    }
    if (result2 === "") hasMore = false;
    result2?.itemList?.forEach((v) => {
      const author = {
        id: v.author.id,
        username: v.author.uniqueId,
        nickname: v.author.nickname,
        avatarLarger: v.author.avatarLarger,
        avatarThumb: v.author.avatarThumb,
        avatarMedium: v.author.avatarMedium,
        signature: v.author.signature,
        verified: v.author.verified,
        openFavorite: v.author.openFavorite,
        privateAccount: v.author.privateAccount,
        isADVirtual: v.author.isADVirtual,
        isEmbedBanned: v.author.isEmbedBanned,
      };
      if (v.imagePost) {
        const images = v.imagePost.images.map((img) => img.imageURL.urlList[0]);
        posts.push({
          id: v.id,
          desc: v.desc,
          createTime: v.createTime,
          digged: v.digged,
          duetEnabled: v.duetEnabled,
          forFriend: v.forFriend,
          officalItem: v.officalItem,
          originalItem: v.originalItem,
          privateItem: v.privateItem,
          shareEnabled: v.shareEnabled,
          stitchEnabled: v.stitchEnabled,
          stats: v.stats,
          music: v.music,
          author,
          images,
        });
      } else {
        const video = {
          id: v.video.id,
          duration: v.video.duration,
          format: v.video.format,
          bitrate: v.video.bitrate,
          ratio: v.video.ratio,
          playAddr: v.video.playAddr,
          cover: v.video.cover,
          originCover: v.video.originCover,
          dynamicCover: v.video.dynamicCover,
          downloadAddr: v.video.downloadAddr,
        };
        posts.push({
          id: v.id,
          desc: v.desc,
          createTime: v.createTime,
          digged: v.digged,
          duetEnabled: v.duetEnabled,
          forFriend: v.forFriend,
          officalItem: v.officalItem,
          originalItem: v.originalItem,
          privateItem: v.privateItem,
          shareEnabled: v.shareEnabled,
          stitchEnabled: v.stitchEnabled,
          stats: v.stats,
          music: v.music,
          author,
          video,
        });
      }
    });
    if (postLimit !== 0) {
      let loopCount = Math.floor(postLimit / 30);
      if (counter >= loopCount) break;
    }
    hasMore = result2.hasMore;
    cursor = hasMore ? result2.cursor : null;
    counter++;
  }
  return postLimit ? posts.slice(0, postLimit) : posts;
};

const xttparams = (params) => {
  const cipher = crypto.createCipheriv(
    "aes-128-cbc",
    Buffer.from("webapp1.0+202106", "utf8"),
    Buffer.from("webapp1.0+202106", "utf8")
  );
  return Buffer.concat([cipher.update(params, 'utf8'), cipher.final()]).toString("base64");
};
