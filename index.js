const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { Client, GatewayIntentBits } = require("discord.js");
const supabase = require("./database/database/supabase");
const { log } = require("./services/services/logger");
const { registerCommands } = require("./commands/registerCommands");
const { handleInteraction } = require("./commands/handlers");
const { getBrandBySlug, getCreatorByCodeAndBrand, recordClick, upsertAttributionSession, generateSessionId, hashIp } = require("./services/trackingService");

const {
  DISCORD_TOKEN,
  BOT_ALERTS_CHANNEL_ID
} = require("./config/config/env");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/r/:brandSlug/:creatorCode', async (req, res) => {
  try {
    const { brandSlug, creatorCode } = req.params;

    // Find brand by slug
    const brand = await getBrandBySlug(brandSlug);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Ensure destination URL exists
    if (!brand.destination_url) {
      return res.status(400).json({ error: 'Brand destination URL not configured' });
    }

    // Find creator
    const creator = await getCreatorByCodeAndBrand(creatorCode, brand.id);
    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Get or create session ID
    let sessionId = req.cookies.partnerlinks_sid;
    if (!sessionId) {
      sessionId = generateSessionId();
    }

    // Extract client info
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    const ipHash = hashIp(clientIp);
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || '';

    // Record click
    const click = await recordClick(
      brand.id,
      creator.id,
      sessionId,
      ipHash,
      userAgent,
      referrer,
      brand.destination_url
    );

    // Upsert attribution session
    await upsertAttributionSession(brand.id, sessionId, creator.id, click.id);

    // Set session cookie (14 days)
    res.cookie('partnerlinks_sid', sessionId, {
      maxAge: 14 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // Redirect to destination
    res.redirect(brand.destination_url);
  } catch (error) {
    log('Referral redirect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/auth/google', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth-google.html'));
});
app.get('/register-business', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register-business.html'));
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", async () => {
  log(`Logged in as ${client.user.tag}`);

  try {
    // Register commands
    await registerCommands(DISCORD_TOKEN);

    const channel = await client.channels.fetch(BOT_ALERTS_CHANNEL_ID);

    if (channel) {
      await channel.send("✅ CreatorOS Bot is online.");
    }

    const { data, error } = await supabase
      .from("brands")
      .select("*")
      .limit(1);

    if (error) {
      log("Supabase connection error:", error.message);
      if (channel) {
        await channel.send(`❌ Supabase connection error: ${error.message}`);
      }
    } else {
      log("Supabase connected successfully.");
    }

  } catch (err) {
    log("Startup error:", err.message);
    try {
      const channel = await client.channels.fetch(BOT_ALERTS_CHANNEL_ID);
      if (channel) {
        await channel.send(`❌ Startup error: ${err.message}`);
      }
    } catch {}
  }
});

client.on('interactionCreate', async (interaction) => {
  await handleInteraction(interaction, client);
});

app.listen(PORT, () => {
  log('PartnerLinks homepage running at http://localhost:3000');
});

client.login(DISCORD_TOKEN);