const express = require('express');
const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send(`
        <html>
        <body style="text-align: center; font-family: sans-serif; padding-top: 50px;">
            <h2>M-Bot Web Pairing</h2>
            <form action="/pair" method="POST">
                <input type="text" name="phone" placeholder="Apna Number (e.g. 923xxxxxxxxx)" required style="padding: 10px; width: 300px;"><br><br>
                <button type="submit" style="padding: 10px 20px; background: green; color: white; border: none;">Get Pairing Code</button>
            </form>
        </body>
        </html>
    `);
});

app.post('/pair', async (req, res) => {
    const phoneNumber = req.body.phone.replace(/[^0-9]/g, '');
    
    // Purana session delete karein taake naya number lag sake
    if (fs.existsSync('./auth_info')) {
        fs.rmSync('./auth_info', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" }),
        browser: ["Chrome (Linux)", "", ""]
    });

    sock.ev.on('creds.update', saveCreds);

    try {
        let code = await sock.requestPairingCode(phoneNumber);
        res.send(`<h2 style="text-align:center;">Pairing Code: ${code}</h2><p>WhatsApp mein ja kar Link Device mein ye code daal dein.</p>`);
    } catch (err) {
        res.send("Error: " + err.message);
    }
});

app.listen(PORT, () => console.log("Server chal raha hai..."));
      const quotedMsgId = msg.message.extendedTextMessage?.contextInfo?.stanzaId;
      if (quotedMsgId && activeRequests.has(quotedMsgId)) {
        const req = activeRequests.get(quotedMsgId);
        
        if (trimmed === '1' || trimmed === '2') {
          activeRequests.delete(quotedMsgId);
          
          // Naya Feature: Reply par random emoji react karna
          const randomReplyEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
          await sock.sendMessage(remoteJid, { react: { text: randomReplyEmoji, key: msg.key } });
          
          // TIKTOK DOWNLOADER
          if (req.type === 'tiktok') {
            try {
              const res = await axios.get(`https://tikwm.com/api/?url=${req.url}`);
              if (res.data && res.data.data) {
                if (trimmed === '1') {
                  await sock.sendMessage(remoteJid, { video: { url: res.data.data.play } });
                } else if (trimmed === '2') {
                  await sock.sendMessage(remoteJid, { audio: { url: res.data.data.music }, mimetype: 'audio/mp4' });
                }
              } else {
                await sock.sendMessage(remoteJid, { text: "❌ Video download nahi ho saki.\nError: API Server Down" });
              }
            } catch(e) { 
              await sock.sendMessage(remoteJid, { text: `❌ Video download nahi ho saki.\nError: ${e.message.split('\n')[0]}` });
            }
          } 
          
          // YOUTUBE DOWNLOADER (Cloud API Linked)
          else if (req.type === 'yt') {
            try {
              let videoUrl = req.query;
              if (!videoUrl.includes('youtu')) {
                const searchRes = await yts(req.query);
                if (searchRes.videos.length > 0) {
                  videoUrl = searchRes.videos[0].url;
                } else {
                  return await sock.sendMessage(remoteJid, { text: "❌ Video nahi mili." });
                }
              }
              
              // 3rd Party API ka use taake 403 block na aaye
              if (trimmed === '1') {
                const apiUrl = `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(videoUrl)}`;
                const res = await axios.get(apiUrl);
                if (res.data && res.data.data && res.data.data.dl) {
                  await sock.sendMessage(remoteJid, { video: { url: res.data.data.dl } });
                } else {
                  await sock.sendMessage(remoteJid, { text: "❌ Cloud API fail ho gayi." });
                }
              } else if (trimmed === '2') {
                const apiUrl = `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`;
                const res = await axios.get(apiUrl);
                if (res.data && res.data.data && res.data.data.dl) {
                  await sock.sendMessage(remoteJid, { audio: { url: res.data.data.dl }, mimetype: 'audio/mp4' });
                } else {
                  await sock.sendMessage(remoteJid, { text: "❌ Cloud API fail ho gayi." });
                }
              }
            } catch(e) { 
              await sock.sendMessage(remoteJid, { text: `❌ Video download nahi ho saki.\nError: Cloud API error` });
            }
          }
        }
        return; 
      }

      // === 2. PUBLIC COMMANDS (Reaction ke sath) ===
      if (trimmed.startsWith(".tiktok ")) {
        const randomEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
        await sock.sendMessage(remoteJid, { react: { text: randomEmoji, key: msg.key } }); 
        
        const url = trimmed.split(" ")[1];
        if (url) {
          const promptMsg = await sock.sendMessage(remoteJid, {
            text: "1 - Video\n2 - Audio\n\nReply with 1 or 2"
          }, { quoted: msg });
          activeRequests.set(promptMsg.key.id, { url, type: 'tiktok' });
        }
        return;
      }

      if (trimmed.startsWith(".yt ")) {
        const randomEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
        await sock.sendMessage(remoteJid, { react: { text: randomEmoji, key: msg.key } }); 
        
        const query = trimmed.substring(4).trim();
        if (query) {
          const promptMsg = await sock.sendMessage(remoteJid, {
            text: "1 - Video\n2 - Audio\n\nReply with 1 or 2"
          }, { quoted: msg });
          activeRequests.set(promptMsg.key.id, { query, type: 'yt' });
        }
        return;
      }

      // === 3. OWNER ONLY COMMANDS ===
      if (isOwner && trimmed === ".vv") {
        const quotedMessage = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMessage) return; 

        let viewOnceObject = quotedMessage.viewOnceMessageV2 || quotedMessage.viewOnceMessage || quotedMessage.viewOnceMessageV2Extension;
        let imageMessage = viewOnceObject?.message?.imageMessage || quotedMessage.imageMessage;
        if (!imageMessage) return; 

        const downloadStructure = viewOnceObject?.message ? { message: viewOnceObject.message } : { message: quotedMessage };
        const buffer = await downloadMediaMessage(
          downloadStructure, 'buffer', {},
          { logger: pino({ level: "silent" }), reconnectIntervalMs: 5000 }
        );

        await sock.sendMessage(remoteJid, { image: buffer });
        return;
      }

      if (isOwner && trimmed === ".menu") {
        await sock.sendMessage(remoteJid, {
          text: `*BOT MENU*

OWNER: .vv, .emon, .emoff
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

      // === 4. AUTO REACT ===
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
