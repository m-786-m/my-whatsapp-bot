const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const axios = require("axios");
const yts = require("yt-search");

let autoReactOn = true;
const activeRequests = new Map();
const reactionEmojis = ['😀', '😂', '😎', '🔥', '✨', '🚀', '🤖', '🎧', '📽️', '👍', '👌', '🎉', '🎶'];

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
  });

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      const phoneNumber = "923268729980";
      const code = await sock.requestPairingCode(phoneNumber);
      console.log("Tumhara pairing code hai:", code);
    }, 3000);
  }

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("Bot connected hogaya!");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  const emojiFindRegex = /\p{Extended_Pictographic}/gu;

  sock.ev.on("messages.upsert", async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg.message) return;

      const isOwner = msg.key.fromMe;
      const remoteJid = msg.key.remoteJid;
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      const trimmed = text.trim();

      const quotedMsgId = msg.message.extendedTextMessage?.contextInfo?.stanzaId;
      if (quotedMsgId && activeRequests.has(quotedMsgId)) {
        const req = activeRequests.get(quotedMsgId);

        if (trimmed === "1" || trimmed === "2") {
          activeRequests.delete(quotedMsgId);

          const randomReplyEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
          await sock.sendMessage(remoteJid, { react: { text: randomReplyEmoji, key: msg.key } });

          if (req.type === "tiktok") {
            try {
              const res = await axios.get(`https://tikwm.com/api/?url=${req.url}`);
              if (res.data && res.data.data) {
                if (trimmed === "1") {
                  await sock.sendMessage(remoteJid, { video: { url: res.data.data.play } });
                } else if (trimmed === "2") {
                  await sock.sendMessage(remoteJid, { audio: { url: res.data.data.music }, mimetype: "audio/mp4" });
                }
              } else {
                await sock.sendMessage(remoteJid, { text: "❌ Download nahi ho saka." });
              }
            } catch (e) {
              await sock.sendMessage(remoteJid, { text: "❌ Download nahi ho saka." });
            }
          } else if (req.type === "yt") {
            try {
              let videoUrl = req.query;
              if (!videoUrl.includes("youtu")) {
                const searchRes = await yts(req.query);
                if (searchRes.videos.length > 0) {
                  videoUrl = searchRes.videos[0].url;
                } else {
                  return await sock.sendMessage(remoteJid, { text: "❌ Video nahi mili." });
                }
              }

              if (trimmed === "1") {
                const apiUrl = `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(videoUrl)}`;
                const res = await axios.get(apiUrl);
                if (res.data?.data?.dl) {
                  await sock.sendMessage(remoteJid, { video: { url: res.data.data.dl } });
                } else {
                  await sock.sendMessage(remoteJid, { text: "❌ Download nahi ho saka." });
                }
              } else if (trimmed === "2") {
                const apiUrl = `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`;
                const res = await axios.get(apiUrl);
                if (res.data?.data?.dl) {
                  await sock.sendMessage(remoteJid, { audio: { url: res.data.data.dl }, mimetype: "audio/mp4" });
                } else {
                  await sock.sendMessage(remoteJid, { text: "❌ Download nahi ho saka." });
                }
              }
            } catch (e) {
              await sock.sendMessage(remoteJid, { text: "❌ Download nahi ho saka." });
            }
          }
        }
        return;
      }

      if (trimmed.startsWith(".tiktok ")) {
        const randomEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
        await sock.sendMessage(remoteJid, { react: { text: randomEmoji, key: msg.key } });

        const url = trimmed.split(" ")[1];
        if (url) {
          const promptMsg = await sock.sendMessage(
            remoteJid,
            { text: "1 - Video\n2 - Audio\n\nReply with 1 or 2" },
            { quoted: msg }
          );
          activeRequests.set(promptMsg.key.id, { url, type: "tiktok" });
        }
        return;
      }

      if (trimmed.startsWith(".yt ")) {
        const randomEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
        await sock.sendMessage(remoteJid, { react: { text: randomEmoji, key: msg.key } });

        const query = trimmed.substring(4).trim();
        if (query) {
          const promptMsg = await sock.sendMessage(
            remoteJid,
            { text: "1 - Video\n2 - Audio\n\nReply with 1 or 2" },
            { quoted: msg }
          );
          activeRequests.set(promptMsg.key.id, { query, type: "yt" });
        }
        return;
      }

      if (isOwner && trimmed === ".menu") {
        await sock.sendMessage(remoteJid, {
          text: `*BOT MENU*

OWNER: .emon, .emoff
PUBLIC: .tiktok <link>, .yt <link/name>`,
        });
        return;
      }

      if (isOwner && trimmed === ".emoff") {
        autoReactOn = false;
        await sock.sendMessage(remoteJid, { text: "Auto-react OFF" });
        return;
      }

      if (isOwner && trimmed === ".emon") {
        autoReactOn = true;
        await sock.sendMessage(remoteJid, { text: "Auto-react ON" });
        return;
      }

      if (isOwner) return;
      if (autoReactOn && trimmed) {
        const found = trimmed.match(emojiFindRegex);
        if (found && found.length > 0) {
          await sock.sendMessage(remoteJid, {
            react: { text: found[0], key: msg.key },
          });
        }
      }
    } catch (err) {
      console.log("Error:", err);
    }
  });
}

startBot();
