const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const supabase = require('../database/database/supabase');
const { log } = require('../services/services/logger');
const { getBrandByGuildId, createBrand } = require('../services/brandService');
const { getCreatorByDiscordUserAndBrand, createCreator, ensureCreatorLinks, getCreatorStats } = require('../services/creatorService');
const {
  getCreatorTrackingStats,
  getLatestAttributionSessionForCreator,
  recordConversion,
  getBrandSalesDashboardStats,
  getCreatorLeaderboardStats
} = require('../services/trackingService');
const { createNetworkEarningsForConversion, getCreatorNetworkStats } = require('../services/creatorNetworkService');
const { getCreatorDashboardByCode } = require('../services/creatorDashboardService');
const { DEFAULT_REF_TEMPLATE, ADMIN_DASHBOARD_CHANNEL_ID, CREATOR_LOG_CHANNEL_ID, BOT_ALERTS_CHANNEL_ID, PUBLIC_BASE_URL } = require('../config/config/env');
const { normalizeCode } = require('../utils/slug');

const interactionResponses = new WeakSet();

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
          await safeInteractionReply(interaction, { content: 'You do not have permission to use this command.', ephemeral: true });
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
          await safeInteractionReply(interaction, { content: 'You do not have permission to use this command.', ephemeral: true });
          return;
        }
        await handleRecordConversion(interaction, guild, client);
        break;
      case 'sales_dashboard':
        if (!isAdmin(member)) {
          await safeInteractionReply(interaction, { content: 'You do not have permission to use this command.', ephemeral: true });
          return;
        }
        await handleSalesDashboard(interaction, guild);
        break;
      case 'creator_leaderboard':
        if (!isAdmin(member)) {
          await safeInteractionReply(interaction, { content: 'You do not have permission to use this command.', ephemeral: true });
          return;
        }
        await handleCreatorLeaderboard(interaction, guild);
        break;
      case 'creator_dashboard':
        if (!isAdmin(member)) {
          await safeInteractionReply(interaction, { content: 'You do not have permission to use this command.', ephemeral: true });
          return;
        }
        await handleCreatorDashboard(interaction);
        break;
      case 'network_stats':
        await handleNetworkStats(interaction, guild);
        break;
      default:
        await safeInteractionReply(interaction, { content: 'Unknown command.', ephemeral: true });
    }
  } catch (error) {
    log('Command error:', error);
    await safeInteractionReply(interaction, {
      content: 'An error occurred while processing your command.',
      ephemeral: true
    });
  }
}

async function handleStart(interaction, guild, client) {
  const user = interaction.user;
  const brand = await getBrandByGuildId(guild.id);
  if (!brand) {
    log('Brand not found for guild:', guild.id);
    await safeInteractionReply(interaction, { content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  let creator = await getCreatorByDiscordUserAndBrand(user.id, brand.id);
  if (creator) {
    creator = await ensureCreatorLinks(creator, brand.name);
    await safeInteractionReply(interaction, { content: `You are already activated.\nReferral link: ${creator.tracking_link}\nCreator invite link: ${creator.join_referral_link}`, ephemeral: true });
    return;
  }

  creator = await createCreator(user.id, user.username, brand.id, brand.ref_link_template, brand.name);

  await safeInteractionReply(interaction, { content: `Welcome!\nReferral link: ${creator.tracking_link}\nCreator invite link: ${creator.join_referral_link}`, ephemeral: true });

  // Post to creator log
  const logChannel = await client.channels.fetch(CREATOR_LOG_CHANNEL_ID);
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setTitle('New Creator Activated')
      .addFields(
        { name: 'Discord Username', value: creator.discord_username },
        { name: 'Creator Code', value: creator.creator_code },
        { name: 'Referral Link', value: creator.tracking_link },
        { name: 'Creator Invite Link', value: creator.join_referral_link || 'Not available' },
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
    await safeInteractionReply(interaction, { content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  const creator = await getCreatorByDiscordUserAndBrand(user.id, brand.id);
  if (!creator) {
    await safeInteractionReply(interaction, { content: 'You are not activated. Run /start first.', ephemeral: true });
    return;
  }

  const updatedCreator = await ensureCreatorLinks(creator, brand.name);
  await safeInteractionReply(interaction, { content: `Referral link: ${updatedCreator.tracking_link}\nCreator invite link: ${updatedCreator.join_referral_link}`, ephemeral: true });
}

async function handleStats(interaction, guild, client) {
  const user = interaction.user;
  const brand = await getBrandByGuildId(guild.id);
  if (!brand) {
    log('Brand not found for guild:', guild.id);
    await safeInteractionReply(interaction, { content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  const creator = await getCreatorByDiscordUserAndBrand(user.id, brand.id);
  if (!creator) {
    await safeInteractionReply(interaction, { content: 'You are not activated. Run /start first.', ephemeral: true });
    return;
  }

  const updatedCreator = await ensureCreatorLinks(creator, brand.name);
  const stats = await getCreatorStats(updatedCreator.id);

  const embed = new EmbedBuilder()
    .setTitle('Your Creator Stats')
    .addFields(
      { name: 'Referral Link', value: updatedCreator.tracking_link },
      { name: 'Creator Invite Link', value: updatedCreator.join_referral_link || 'Not available' },
      { name: 'Submissions', value: stats.submissionCount.toString() },
      { name: 'Approved', value: updatedCreator.approved ? 'Yes' : 'No' }
    )
    .setColor(0xffa500);

  await safeInteractionReply(interaction, { embeds: [embed], ephemeral: true });
}

async function handleTrackingStats(interaction, guild, client) {
  const user = interaction.user;
  const brand = await getBrandByGuildId(guild.id);
  if (!brand) {
    log('Brand not found for guild:', guild.id);
    await safeInteractionReply(interaction, { content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  const creator = await getCreatorByDiscordUserAndBrand(user.id, brand.id);
  if (!creator) {
    await safeInteractionReply(interaction, { content: 'You are not activated. Run /start first.', ephemeral: true });
    return;
  }

  const updatedCreator = await ensureCreatorLinks(creator, brand.name);
  const trackingStats = await getCreatorTrackingStats(updatedCreator.id);
  const embed = new EmbedBuilder()
    .setTitle('Your Tracking Stats')
    .addFields(
      { name: 'Referral Link', value: updatedCreator.tracking_link || 'Not available' },
      { name: 'Creator Invite Link', value: updatedCreator.join_referral_link || 'Not available' },
      { name: 'Total Clicks', value: trackingStats.totalClicks.toString() },
      { name: 'Unique Sessions', value: trackingStats.uniqueSessions.toString() },
      { name: 'Total Conversions', value: trackingStats.totalConversions.toString() },
      { name: 'Total Revenue Generated', value: formatMoney(trackingStats.totalRevenue) },
      { name: 'Estimated Campaign Commission Earned', value: formatMoney(trackingStats.estimatedCommission) },
      { name: 'Creator Network Earnings Earned', value: formatMoney(trackingStats.creatorNetworkEarnings) },
      { name: 'Last Click', value: trackingStats.lastClick || 'No clicks yet' }
    )
    .setColor(0x0099ff);

  await safeInteractionReply(interaction, { embeds: [embed], ephemeral: true });
}

async function handleRecordConversion(interaction, guild, client) {
  const creatorCode = normalizeCode(interaction.options.getString('creator_code'));
  const orderValue = interaction.options.getNumber('order_value');
  const commissionRate = interaction.options.getNumber('commission_rate');
  const orderId = interaction.options.getString('order_id');
  const notes = interaction.options.getString('notes');
  const platformFeeAmount = interaction.options.getNumber('platform_fee_amount') || 0;

  await safeDeferInteraction(interaction, { ephemeral: true });

  if (orderValue == null || orderValue < 0 || commissionRate == null || commissionRate < 0 || platformFeeAmount < 0) {
    await safeInteractionReply(interaction, { content: 'Order value, commission rate, and platform fee must be zero or greater.', ephemeral: true });
    return;
  }

  const brand = await getBrandByGuildId(guild.id);
  if (!brand) {
    log('Brand not found for guild:', guild.id);
    await safeInteractionReply(interaction, { content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  const creatorLookup = await findCreatorForConversion(creatorCode);
  console.log('record_conversion creator lookup:', {
    input_creator_code: creatorCode,
    creator_code_lookup: summarizeCreatorLookup(creatorLookup.creatorCodeMatches),
    referral_code_lookup: summarizeCreatorLookup(creatorLookup.referralCodeMatches),
    lookup_errors: creatorLookup.errors
  });

  const creator = creatorLookup.creator;
  if (!creator) {
    await safeInteractionReply(interaction, { content: `No creator found for code "${creatorCode}".`, ephemeral: true });
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
    platformFeeAmount,
    notes
  });
  const networkEarnings = await createNetworkEarningsForConversion({
    sourceCreatorId: creator.id,
    conversionId: conversion.id,
    platformFeeAmount
  });

  const attributionNote = attributionSession ? `Session: ${attributionSession.session_id}` : 'No prior click session found.';
  const summary = [
    `Recorded conversion for ${creator.discord_username} (${creator.creator_code}).`,
    `Order value: ${formatMoney(orderValue)}`,
    `Commission: ${formatMoney(commissionAmount)} at ${formatPercent(commissionRate)}`,
    `Platform fee: ${formatMoney(platformFeeAmount)}`,
    `Network earnings created: ${networkEarnings.length}`,
    attributionNote
  ].join('\n');

  await safeInteractionReply(interaction, { content: summary, ephemeral: true });

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
          { name: 'Platform Fee', value: formatMoney(platformFeeAmount), inline: true },
          { name: 'Network Earnings Rows', value: networkEarnings.length.toString(), inline: true },
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
    await safeInteractionReply(interaction, { content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
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
      { name: 'Platform Fees Recorded', value: formatMoney(stats.totalPlatformFees), inline: true },
      { name: 'Network Earnings Owed', value: formatMoney(stats.totalCreatorNetworkEarningsOwed), inline: true },
      { name: 'Level 1 Network Earnings', value: formatMoney(stats.levelOneNetworkEarnings), inline: true },
      { name: 'Level 2 Network Earnings', value: formatMoney(stats.levelTwoNetworkEarnings), inline: true },
      { name: 'Level 3 Network Earnings', value: formatMoney(stats.levelThreeNetworkEarnings), inline: true },
      { name: 'Latest Conversion', value: stats.latestConversionDate || 'No conversions yet', inline: true }
    )
    .setColor(0x00aa55);

  await safeInteractionReply(interaction, { embeds: [embed], ephemeral: true });
}

async function handleCreatorLeaderboard(interaction, guild) {
  const brand = await getBrandByGuildId(guild.id);
  if (!brand) {
    log('Brand not found for guild:', guild.id);
    await safeInteractionReply(interaction, { content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  const leaderboard = await getCreatorLeaderboardStats(brand.id, 10);
  if (!leaderboard.length) {
    await safeInteractionReply(interaction, { content: 'No creators found for this brand yet.', ephemeral: true });
    return;
  }

  const activeRows = leaderboard.filter((row) => row.clicks || row.conversions || row.revenue || row.estimatedCommission);
  if (!activeRows.length) {
    await safeInteractionReply(interaction, { content: 'No creator sales activity yet.', ephemeral: true });
    return;
  }

  const description = activeRows
    .map((row, index) => [
      `**${index + 1}. ${row.creatorCode}**`,
      `Clicks: ${row.clicks}`,
      `Conversions: ${row.conversions}`,
      `Revenue: ${formatMoney(row.revenue)}`,
      `Campaign commission: ${formatMoney(row.estimatedCommission)}`,
      `Network earnings: ${formatMoney(row.networkEarnings)}`
    ].join('\n'))
    .join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle(`${brand.name} Creator Leaderboard`)
    .setDescription(description)
    .setColor(0x0099ff);

  await safeInteractionReply(interaction, { embeds: [embed], ephemeral: true });
}

async function handleNetworkStats(interaction, guild) {
  const user = interaction.user;
  const brand = await getBrandByGuildId(guild.id);
  if (!brand) {
    log('Brand not found for guild:', guild.id);
    await safeInteractionReply(interaction, { content: 'Brand not set up. Run /brand_setup first.', ephemeral: true });
    return;
  }

  const creator = await getCreatorByDiscordUserAndBrand(user.id, brand.id);
  if (!creator) {
    await safeInteractionReply(interaction, { content: 'You are not activated. Run /start first.', ephemeral: true });
    return;
  }

  const updatedCreator = await ensureCreatorLinks(creator, brand.name);
  const stats = await getCreatorNetworkStats(updatedCreator.id);
  const embed = new EmbedBuilder()
    .setTitle('Your Creator Network Stats')
    .addFields(
      { name: 'Creator Invite Link', value: updatedCreator.join_referral_link || 'Not available' },
      { name: 'Direct Referred Creators', value: stats.directReferredCreators.toString(), inline: true },
      { name: 'Second-Level Creators', value: stats.secondLevelCreators.toString(), inline: true },
      { name: 'Third-Level Creators', value: stats.thirdLevelCreators.toString(), inline: true },
      { name: 'Network Earnings Earned', value: formatMoney(stats.networkEarnings), inline: true }
    )
    .setColor(0x6a5acd);

  await safeInteractionReply(interaction, { embeds: [embed], ephemeral: true });
}

async function handleCreatorDashboard(interaction) {
  const creatorCode = normalizeCode(interaction.options.getString('creator_code'));
  const dashboard = await getCreatorDashboardByCode(creatorCode);
  if (!dashboard) {
    await safeInteractionReply(interaction, { content: `No creator found for code "${creatorCode}".`, ephemeral: true });
    return;
  }

  const dashboardUrl = `${PUBLIC_BASE_URL}/dashboard/${dashboard.creatorCode}`;
  const embed = new EmbedBuilder()
    .setTitle('Creator Dashboard')
    .setDescription(dashboardUrl)
    .addFields(
      { name: 'Creator', value: `${dashboard.displayName} (${dashboard.creatorCode})` },
      { name: 'Invite Link', value: dashboard.inviteLink || 'Not available' },
      { name: 'Direct Referrals', value: dashboard.directReferralsCount.toString(), inline: true },
      { name: 'Second-Level', value: dashboard.secondLevelReferralsCount.toString(), inline: true },
      { name: 'Third-Level', value: dashboard.thirdLevelReferralsCount.toString(), inline: true },
      { name: 'Conversions', value: dashboard.totalConversions.toString(), inline: true },
      { name: 'Order Value', value: formatMoney(dashboard.totalOrderValue), inline: true },
      { name: 'Total Earnings', value: formatMoney(dashboard.totalEarnings), inline: true }
    )
    .setColor(0x9b5cff);

  await safeInteractionReply(interaction, { embeds: [embed], ephemeral: true });
}

async function handleBrandSetup(interaction, guild, client) {
  const name = interaction.options.getString('name');
  const refLinkTemplate = interaction.options.getString('ref_link_template') || DEFAULT_REF_TEMPLATE;

  console.log('handleBrandSetup guild.id:', guild.id, 'name:', name, 'refLinkTemplate:', refLinkTemplate);
  const brand = await createBrand(guild.id, name, refLinkTemplate);

  await safeInteractionReply(interaction, { content: 'Brand set up successfully!', ephemeral: true });

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

async function findCreatorForConversion(creatorCode) {
  const normalizedCreatorCode = normalizeCode(creatorCode);
  const errors = {};
  const { data: creatorCodeMatches, error: creatorCodeError } = await supabase
    .from('creators')
    .select('*')
    .eq('creator_code', normalizedCreatorCode)
    .order('created_at', { ascending: false });
  if (creatorCodeError) {
    errors.creator_code = {
      code: creatorCodeError.code,
      message: creatorCodeError.message
    };
  }

  const { data: referralCodeMatches, error: referralCodeError } = await supabase
    .from('creators')
    .select('*')
    .eq('referral_code', normalizedCreatorCode)
    .order('created_at', { ascending: false });
  if (referralCodeError) {
    errors.referral_code = {
      code: referralCodeError.code,
      message: referralCodeError.message
    };
  }

  const creator = (!creatorCodeError && creatorCodeMatches && creatorCodeMatches.length)
    ? creatorCodeMatches[0]
    : (!referralCodeError && referralCodeMatches && referralCodeMatches.length ? referralCodeMatches[0] : null);

  return {
    creator,
    creatorCodeMatches: creatorCodeMatches || [],
    referralCodeMatches: referralCodeMatches || [],
    errors
  };
}

function summarizeCreatorLookup(creators) {
  return (creators || []).map((creator) => ({
    id: creator.id,
    creator_code: creator.creator_code,
    referral_code: creator.referral_code,
    brand_id: creator.brand_id,
    auth_user_id: creator.auth_user_id,
    discord_user_id: creator.discord_user_id
  }));
}

async function safeInteractionReply(interaction, payload) {
  if (interactionResponses.has(interaction)) {
    log('Skipping duplicate interaction response for command:', interaction.commandName);
    return;
  }

  if (interaction.deferred === true && interaction.replied === false) {
    try {
      await interaction.editReply(payload);
      interactionResponses.add(interaction);
    } catch (error) {
      log('Interaction deferred edit response failed:', error);
    }
    return;
  }

  if (interaction.replied === true) {
    try {
      await interaction.followUp(payload);
      interactionResponses.add(interaction);
    } catch (error) {
      log('Interaction follow-up response failed:', error);
    }
    return;
  }

  try {
    await interaction.reply(payload);
    interactionResponses.add(interaction);
  } catch (error) {
    log('Interaction initial reply failed:', error);
  }
}

async function safeDeferInteraction(interaction, options = {}) {
  if (interaction.replied === true || interaction.deferred === true) return;

  try {
    await interaction.deferReply(options);
  } catch (error) {
    log('Interaction defer failed:', error);
  }
}

module.exports = {
  handleInteraction
};
