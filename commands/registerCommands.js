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
      },
      {
        name: 'platform_fee_amount',
        type: 10, // NUMBER
        description: 'Optional PartnerLinks platform fee amount',
        required: false,
        min_value: 0
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
  },
  {
    name: 'creator_dashboard',
    description: 'Get a creator dashboard URL and quick stats',
    options: [
      {
        name: 'creator_code',
        type: 3, // STRING
        description: 'Creator code or referral code',
        required: true
      }
    ]
  },
  {
    name: 'network_stats',
    description: 'View your creator invite network performance'
  },
  {
    name: 'shopify_attribution_debug',
    description: 'Inspect recent Shopify webhook attribution decisions',
    options: [
      {
        name: 'order_id',
        type: 3, // STRING
        description: 'Optional Shopify/PartnerLinks order id',
        required: false
      },
      {
        name: 'creator_code',
        type: 3, // STRING
        description: 'Optional creator code filter',
        required: false
      },
      {
        name: 'limit',
        type: 4, // INTEGER
        description: 'Number of rows to show, max 10',
        required: false,
        min_value: 1,
        max_value: 10
      }
    ]
  }
];

async function registerCommands(token) {
  const rest = new REST({ version: '9' }).setToken(token);

  try {
    console.log('Registering application commands:', commands.map((command) => `/${command.name}`).join(', '));
    const recordConversionCommand = commands.find((command) => command.name === 'record_conversion');
    console.log(
      'Registering /record_conversion options:',
      recordConversionCommand.options.map((option) => `${option.name}:${option.type}${option.required ? ':required' : ':optional'}`).join(', ')
    );
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log('Successfully registered application commands:', commands.map((command) => `/${command.name}`).join(', '));
  } catch (error) {
    console.error(error);
  }
}

module.exports = {
  registerCommands,
  commands
};
