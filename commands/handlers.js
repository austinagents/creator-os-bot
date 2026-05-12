const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { log } = require('../services/services/logger');
const { getBrandByGuildId, createBrand } = require('../services/brandService');
const { getCreatorByDiscordUserAndBrand, getCreatorByCode, createCreator, ensureTrackingLink, getCreatorStats } = require('../services/creatorService');
const {
  getCreatorTrackingStats,
  getLatestAttributionSessionForCreator,
  recordConversion,
  getBrandSalesDashboardStats,
  getCreatorLeaderboardStats
} = require('../services/trackingService');
const { DEFAULT_REF_TEMPLATE, ADMIN_DASHBOARD_CHANNEL_ID, CREATOR_LOG_CHANNEL_ID, BOT_ALERTS_CHANNEL_ID } = require('../config/config/env');


function isAdmin(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator) || member.permissions.has(PermissionsBitField.Flags.ManageGuild);
}

async function handleInteraction(interaction, client) {
  if (!interaction.isCommand()) return;

  const { commandName, guild, member } = interaction;

  try {
    switch (commandName) {
      case 'brand_setup':
        if (!isAdmin(member)) {
          await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
          return;
        }
        await handleBrandSetup(interaction, guild, client);
        break;
      case 'start':
        await handleStart(interaction, guild, client);
        break;
      case 'link':
        await handleLink(interaction, guild, client);
        break;
      case 'stats':
        await handleStats(interaction, guild, client);
        break;
      case 'tracking_stats':
        await handleTrackingStats(interaction, guild, client);
        break;
      case 'record_conversion':
        if (!isAdmin(member)) {
          await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
          return;
        }
        await handleRecordConversion(interaction, guild, client);
        break;
      case 'sales_dashboard':
        if (!isAdmin(member)) {
          await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
          return;
        }
        await handleSalesDashboard(interaction, guild);
        break;
      case 'creator_leaderboard':
        if (!isAdmin(member)) {
          await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
          return;
        }
        await handleCreatorLeaderboard(interaction, guild);
        break;
      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  } catch (error) {
    log('Command error:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'An error occurred while processing your command.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'An error occurred while processing your command.', ephemeral: true });
    }
  }
}

async function handleStart(interaction, guild, client) {
  const user = interaction.user;
  const brand = await getBrandByGuildId(guild.id);
  if (!brand) {
    log('Brand not found for guild:', guild.id);
    await interaction.reply({ content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  let creator = await getCreatorByDiscordUserAndBrand(user.id, brand.id);
  if (creator) {
    creator = await ensureTrackingLink(creator, brand.name);
    await interaction.reply({ content: `You are already activated. Your referral link: ${creator.tracking_link}`, ephemeral: true });
    return;
  }

  creator = await createCreator(user.id, user.username, brand.id, brand.ref_link_template, brand.name);

  await interaction.reply({ content: `Welcome! Your referral link: ${creator.tracking_link}`, ephemeral: true });

  // Post to creator log
  const logChannel = await client.channels.fetch(CREATOR_LOG_CHANNEL_ID);
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setTitle('New Creator Activated')
      .addFields(
        { name: 'Discord Username', value: creator.discord_username },
        { name: 'Creator Code', value: creator.creator_code },
        { name: 'Referral Link', value: creator.tracking_link },
        { name: 'Approved', value: creator.approved ? 'Yes' : 'No' }
      )
      .setColor(0x00ff00);
    await logChannel.send({ embeds: [embed] });
  }
}

async function handleLink(interaction, guild, client) {
  const user = interaction.user;
  const brand = await getBrandByGuildId(guild.id);
  if (!brand) {
    log('Brand not found for guild:', guild.id);
    await interaction.reply({ content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  const creator = await getCreatorByDiscordUserAndBrand(user.id, brand.id);
  if (!creator) {
    await interaction.reply({ content: 'You are not activated. Run /start first.', ephemeral: true });
    return;
  }

  const updatedCreator = await ensureTrackingLink(creator, brand.name);
  await interaction.reply({ content: `Your referral link: ${updatedCreator.tracking_link}`, ephemeral: true });
}

async function handleStats(interaction, guild, client) {
  const user = interaction.user;
  const brand = await getBrandByGuildId(guild.id);
  if (!brand) {
    log('Brand not found for guild:', guild.id);
    await interaction.reply({ content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  const creator = await getCreatorByDiscordUserAndBrand(user.id, brand.id);
  if (!creator) {
    await interaction.reply({ content: 'You are not activated. Run /start first.', ephemeral: true });
    return;
  }

  const updatedCreator = await ensureTrackingLink(creator, brand.name);
  const stats = await getCreatorStats(updatedCreator.id);

  const embed = new EmbedBuilder()
    .setTitle('Your Creator Stats')
    .addFields(
      { name: 'Referral Link', value: updatedCreator.tracking_link },
      { name: 'Submissions', value: stats.submissionCount.toString() },
      { name: 'Approved', value: updatedCreator.approved ? 'Yes' : 'No' }
    )
    .setColor(0xffa500);

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleTrackingStats(interaction, guild, client) {
  const user = interaction.user;
  const brand = await getBrandByGuildId(guild.id);
  if (!brand) {
    log('Brand not found for guild:', guild.id);
    await interaction.reply({ content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  const creator = await getCreatorByDiscordUserAndBrand(user.id, brand.id);
  if (!creator) {
    await interaction.reply({ content: 'You are not activated. Run /start first.', ephemeral: true });
    return;
  }

  const trackingStats = await getCreatorTrackingStats(creator.id);
  const embed = new EmbedBuilder()
    .setTitle('Your Tracking Stats')
    .addFields(
      { name: 'Referral Link', value: creator.tracking_link || 'Not available' },
      { name: 'Total Clicks', value: trackingStats.totalClicks.toString() },
      { name: 'Unique Sessions', value: trackingStats.uniqueSessions.toString() },
      { name: 'Total Conversions', value: trackingStats.totalConversions.toString() },
      { name: 'Total Revenue Generated', value: formatMoney(trackingStats.totalRevenue) },
      { name: 'Estimated Commission Earned', value: formatMoney(trackingStats.estimatedCommission) },
      { name: 'Last Click', value: trackingStats.lastClick || 'No clicks yet' }
    )
    .setColor(0x0099ff);

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRecordConversion(interaction, guild, client) {
  const creatorCode = interaction.options.getString('creator_code');
  const orderValue = interaction.options.getNumber('order_value');
  const commissionRate = interaction.options.getNumber('commission_rate');
  const orderId = interaction.options.getString('order_id');
  const notes = interaction.options.getString('notes');

  if (orderValue == null || orderValue < 0 || commissionRate == null || commissionRate < 0) {
    await interaction.reply({ content: 'Order value and commission rate must be zero or greater.', ephemeral: true });
    return;
  }

  const brand = await getBrandByGuildId(guild.id);
  if (!brand) {
    log('Brand not found for guild:', guild.id);
    await interaction.reply({ content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  const creator = await getCreatorByCode(creatorCode, brand.id);
  if (!creator) {
    await interaction.reply({ content: `No creator found for code "${creatorCode}".`, ephemeral: true });
    return;
  }

  const attributionSession = await getLatestAttributionSessionForCreator(brand.id, creator.id);
  const commissionAmount = roundCurrency(orderValue * commissionRate / 100);
  const conversion = await recordConversion({
    brandId: brand.id,
    creatorId: creator.id,
    attributionSessionId: attributionSession ? attributionSession.id : null,
    clickId: attributionSession ? attributionSession.last_click_id : null,
    sessionId: attributionSession ? attributionSession.session_id : null,
    orderId,
    orderValue,
    commissionRate,
    commissionAmount,
    notes
  });

  const attributionNote = attributionSession ? `Session: ${attributionSession.session_id}` : 'No prior click session found.';
  const summary = [
    `Recorded conversion for ${creator.discord_username} (${creator.creator_code}).`,
    `Order value: ${formatMoney(orderValue)}`,
    `Commission: ${formatMoney(commissionAmount)} at ${formatPercent(commissionRate)}`,
    attributionNote
  ].join('\n');

  await interaction.reply({ content: summary, ephemeral: true });

  const alertsChannelId = BOT_ALERTS_CHANNEL_ID || ADMIN_DASHBOARD_CHANNEL_ID;
  if (alertsChannelId) {
    const channel = await client.channels.fetch(alertsChannelId).catch(() => null);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('Conversion Recorded')
        .addFields(
          { name: 'Creator', value: `${creator.discord_username} (${creator.creator_code})` },
          { name: 'Order Value', value: formatMoney(orderValue), inline: true },
          { name: 'Commission', value: formatMoney(commissionAmount), inline: true },
          { name: 'Rate', value: formatPercent(commissionRate), inline: true },
          { name: 'Order ID', value: conversion.order_id || 'Not provided' },
          { name: 'Session', value: conversion.session_id || 'No click session found' },
          { name: 'Notes', value: formatEmbedField(conversion.notes || 'None') }
        )
        .setColor(0x00aa55);
      await channel.send({ embeds: [embed] });
    }
  }
}

async function handleSalesDashboard(interaction, guild) {
  const brand = await getBrandByGuildId(guild.id);
  if (!brand) {
    log('Brand not found for guild:', guild.id);
    await interaction.reply({ content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  const stats = await getBrandSalesDashboardStats(brand.id);
  const embed = new EmbedBuilder()
    .setTitle(`${brand.name} Sales Dashboard`)
    .addFields(
      { name: 'Total Clicks', value: stats.totalClicks.toString(), inline: true },
      { name: 'Unique Sessions', value: stats.uniqueSessions.toString(), inline: true },
      { name: 'Total Conversions', value: stats.totalConversions.toString(), inline: true },
      { name: 'Total Revenue Generated', value: formatMoney(stats.totalRevenue), inline: true },
      { name: 'Estimated Commissions Owed', value: formatMoney(stats.estimatedCommissionsOwed), inline: true },
      { name: 'Latest Conversion', value: stats.latestConversionDate || 'No conversions yet', inline: true }
    )
    .setColor(0x00aa55);

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCreatorLeaderboard(interaction, guild) {
  const brand = await getBrandByGuildId(guild.id);
  if (!brand) {
    log('Brand not found for guild:', guild.id);
    await interaction.reply({ content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  const leaderboard = await getCreatorLeaderboardStats(brand.id, 10);
  if (!leaderboard.length) {
    await interaction.reply({ content: 'No creators found for this brand yet.', ephemeral: true });
    return;
  }

  const activeRows = leaderboard.filter((row) => row.clicks || row.conversions || row.revenue || row.estimatedCommission);
  if (!activeRows.length) {
    await interaction.reply({ content: 'No creator sales activity yet.', ephemeral: true });
    return;
  }

  const description = activeRows
    .map((row, index) => [
      `**${index + 1}. ${row.creatorCode}**`,
      `Clicks: ${row.clicks}`,
      `Conversions: ${row.conversions}`,
      `Revenue: ${formatMoney(row.revenue)}`,
      `Commission: ${formatMoney(row.estimatedCommission)}`
    ].join('\n'))
    .join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle(`${brand.name} Creator Leaderboard`)
    .setDescription(description)
    .setColor(0x0099ff);

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleBrandSetup(interaction, guild, client) {
  const name = interaction.options.getString('name');
  const refLinkTemplate = interaction.options.getString('ref_link_template') || DEFAULT_REF_TEMPLATE;

  console.log('handleBrandSetup guild.id:', guild.id, 'name:', name, 'refLinkTemplate:', refLinkTemplate);
  const brand = await createBrand(guild.id, name, refLinkTemplate);

  await interaction.reply({ content: 'Brand set up successfully!', ephemeral: true });

  // Post to admin dashboard
  const channel = await client.channels.fetch(ADMIN_DASHBOARD_CHANNEL_ID);
  if (channel) {
    const embed = new EmbedBuilder()
      .setTitle('Brand Setup')
      .addFields(
        { name: 'Name', value: brand.name },
        { name: 'Template', value: brand.ref_link_template }
      )
      .setColor(0x00ff00);
    await channel.send({ embeds: [embed] });
  }
}

function roundCurrency(value) {
  return Math.round(Number(value) * 100) / 100;
}

function formatMoney(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value).toFixed(2).replace(/\.00$/, '')}%`;
}

function formatEmbedField(value) {
  const text = String(value || 'None');
  return text.length > 1024 ? `${text.slice(0, 1021)}...` : text;
}

module.exports = {
  handleInteraction
};
