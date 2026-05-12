const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = require('../config/config/env');

const commands = [
  // Admin commands
  {
    name: 'brand_setup',
    description: 'Set up or update the brand for this server',
    options: [
      {
        name: 'name',
        type: 3, // STRING
        description: 'Brand name',
        required: true
      },
      {
        name: 'ref_link_template',
        type: 3, // STRING
        description: 'Referral link template (optional)',
        required: false
      }
    ]
  },
  // Creator commands
  {
    name: 'start',
    description: 'Activate as a creator and get your referral link'
  },
  {
    name: 'link',
    description: 'Get your referral link'
  },
  {
    name: 'stats',
    description: 'View your creator stats'
  },
  {
    name: 'tracking_stats',
    description: 'View your referral tracking performance'
  },
  {
    name: 'record_conversion',
    description: 'Record a manual referral sale conversion',
    options: [
      {
        name: 'creator_code',
        type: 3, // STRING
        description: 'Creator code credited for the sale',
        required: true
      },
      {
        name: 'order_value',
        type: 10, // NUMBER
        description: 'Order value before commission',
        required: true,
        min_value: 0
      },
      {
        name: 'commission_rate',
        type: 10, // NUMBER
        description: 'Commission percentage for this sale',
        required: true,
        min_value: 0
      },
      {
        name: 'order_id',
        type: 3, // STRING
        description: 'Optional order ID',
        required: false
      },
      {
        name: 'notes',
        type: 3, // STRING
        description: 'Optional internal notes',
        required: false
      }
    ]
  },
  {
    name: 'sales_dashboard',
    description: 'View current brand sales performance'
  },
  {
    name: 'creator_leaderboard',
    description: 'View top creators by referral sales performance'
  }
];

async function registerCommands(token) {
  const rest = new REST({ version: '9' }).setToken(token);

  try {
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error(error);
  }
}

module.exports = {
  registerCommands
};
