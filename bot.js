const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const http = require('http');

// ── Config ──
const BOT_TOKEN  = process.env.BOT_TOKEN; // set this in Railway environment variables
const CLIENT_ID  = '1470840282760085515';
const GUILD_ID   = '1477747478747938907';
const CHANNEL_ID = '1477766495491850456'; // applications channel
const ROLE_NAME  = 'Probationary Police Constable';
const PORT       = process.env.PORT || 3001;

// ── Slash Commands ──
const commands = [
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(opt => opt.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .addStringOption(opt => opt.setName('userid').setDescription('The user ID to unban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for unban'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(opt => opt.setName('user').setDescription('The user to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a user (mute)')
    .addUserOption(opt => opt.setName('user').setDescription('The user to mute').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for mute'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout from a user (unmute)')
    .addUserOption(opt => opt.setName('user').setDescription('The user to unmute').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(opt => opt.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete messages from a channel')
    .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
].map(cmd => cmd.toJSON());

// ── HTTP server — receives applications from the website ──────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'POST' && req.url === '/apply') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        await postApplication(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error('Application error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

async function postApplication(data) {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) throw new Error('Applications channel not found');

  const embed = new EmbedBuilder()
    .setTitle('🚔 New Officer Application')
    .setColor(0x003087)
    .addFields(
      { name: 'Discord',             value: data.discord    || 'N/A', inline: true },
      { name: 'Roblox',              value: data.roblox     || 'N/A', inline: true },
      { name: 'Age',                 value: data.age        || 'N/A', inline: true },
      { name: 'Timezone',            value: data.timezone   || 'N/A', inline: true },
      { name: 'Activity',            value: data.activity   || 'N/A', inline: true },
      { name: 'Experience',          value: data.experience || 'N/A' },
      { name: 'Previous Groups',     value: data.prevGroups || 'None' },
      { name: 'Why join MPS?',       value: (data.whyJoin   || 'N/A').slice(0, 1024) },
      { name: 'What can you bring?', value: (data.whatBring || 'N/A').slice(0, 1024) }
    )
    .setTimestamp()
    .setFooter({ text: 'MPS Roblox — reflexpvp.co.uk' });

  // Store applicant username in button ID (max 100 chars total)
  const safeUser = (data.discord || 'unknown').slice(0, 85);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept:${safeUser}`)
      .setLabel('✅ Accept')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`reject:${safeUser}`)
      .setLabel('❌ Reject')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ── Register Commands ──
async function registerCommands() {
  const rest = new REST().setToken(BOT_TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Slash commands registered!');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
}

// ── Bot Client ──
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ]
});

// Helper: make a mod embed
function modEmbed(action, target, moderator, reason, color) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${action}`)
    .addFields(
      { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'Moderator', value: `${moderator.tag}`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided' }
    )
    .setTimestamp();
}

client.once('ready', () => {
  console.log(`Bot is online as ${client.user.tag}`);
  client.user.setActivity('REFLEX PVP', { type: 3 });
  server.listen(PORT, () => console.log(`✅ Application server on port ${PORT}`));
});

client.on('interactionCreate', async (interaction) => {
  // ── Application buttons ──────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const colonIdx = interaction.customId.indexOf(':');
    const action   = interaction.customId.slice(0, colonIdx);
    const username = interaction.customId.slice(colonIdx + 1);

    if (action === 'accept') {
      try {
        const guild = await client.guilds.fetch(GUILD_ID);
        await guild.members.fetch();

        const member = guild.members.cache.find(m =>
          m.user.username.toLowerCase() === username.toLowerCase() ||
          (m.user.tag && m.user.tag.toLowerCase() === username.toLowerCase())
        );

        if (!member) {
          return interaction.reply({
            content: `⚠️ Couldn't find **${username}** in the server. Make sure they've joined first, then add the role manually.`,
            ephemeral: true
          });
        }

        const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
        if (!role) {
          return interaction.reply({
            content: `⚠️ Role "${ROLE_NAME}" not found. Check the name matches exactly.`,
            ephemeral: true
          });
        }

        await member.roles.add(role);

        const updated = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x2ecc71)
          .setFooter({ text: `✅ Accepted by ${interaction.user.tag} — Role given` });

        return interaction.update({ embeds: [updated], components: [] });

      } catch (err) {
        return interaction.reply({ content: `Error: ${err.message}`, ephemeral: true });
      }
    }

    if (action === 'reject') {
      const updated = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0xe74c3c)
        .setFooter({ text: `❌ Rejected by ${interaction.user.tag}` });

      return interaction.update({ embeds: [updated], components: [] });
    }

    return; // unknown button, ignore
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // ── /ban ──
  if (commandName === 'ban') {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }
    if (!member.bannable) {
      return interaction.reply({ content: 'I cannot ban this user. They may have a higher role than me.', ephemeral: true });
    }

    await member.ban({ reason });
    const embed = modEmbed('User Banned', user, interaction.user, reason, 0xff4444);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /unban ──
  else if (commandName === 'unban') {
    const userId = interaction.options.getString('userid');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const banInfo = await interaction.guild.bans.fetch(userId);
      await interaction.guild.members.unban(userId, reason);
      const embed = new EmbedBuilder()
        .setColor(0x00ff5a)
        .setTitle('User Unbanned')
        .addFields(
          { name: 'User', value: `${banInfo.user.tag} (${userId})`, inline: true },
          { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } catch {
      await interaction.reply({ content: 'Could not unban. User may not be banned or the ID is invalid.', ephemeral: true });
    }
  }

  // ── /kick ──
  else if (commandName === 'kick') {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }
    if (!member.kickable) {
      return interaction.reply({ content: 'I cannot kick this user. They may have a higher role than me.', ephemeral: true });
    }

    await member.kick(reason);
    const embed = modEmbed('User Kicked', user, interaction.user, reason, 0xffa500);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /mute ──
  else if (commandName === 'mute') {
    const user = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }
    if (!member.moderatable) {
      return interaction.reply({ content: 'I cannot mute this user. They may have a higher role than me.', ephemeral: true });
    }

    const ms = minutes * 60 * 1000;
    if (ms > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({ content: 'Timeout cannot exceed 28 days.', ephemeral: true });
    }

    await member.timeout(ms, reason);
    const embed = modEmbed(`User Muted (${minutes} min)`, user, interaction.user, reason, 0xf0b232);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /unmute ──
  else if (commandName === 'unmute') {
    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    await member.timeout(null);
    const embed = new EmbedBuilder()
      .setColor(0x00ff5a)
      .setTitle('User Unmuted')
      .addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Moderator', value: `${interaction.user.tag}`, inline: true }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  // ── /warn ──
  else if (commandName === 'warn') {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const embed = modEmbed('User Warned', user, interaction.user, reason, 0xf0b232);
    await interaction.reply({ embeds: [embed] });

    // DM the user
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xf0b232)
        .setTitle('You have been warned')
        .setDescription(`You received a warning in **${interaction.guild.name}**`)
        .addFields({ name: 'Reason', value: reason })
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] });
    } catch {
      // User has DMs closed, that's fine
    }
  }

  // ── /clear ──
  else if (commandName === 'clear') {
    const amount = interaction.options.getInteger('amount');

    if (amount < 1 || amount > 100) {
      return interaction.reply({ content: 'Amount must be between 1 and 100.', ephemeral: true });
    }

    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({ content: `Deleted **${deleted.size}** messages.`, ephemeral: true });
  }
});

// ── Start ──
registerCommands();
client.login(BOT_TOKEN);
