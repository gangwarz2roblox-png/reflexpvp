const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');

// ══════════════════════════════════════════
//  CONFIG — fill in BOT_TOKEN via env var
// ══════════════════════════════════════════
const BOT_TOKEN   = process.env.MET_BOT_TOKEN;
const CLIENT_ID   = process.env.MET_CLIENT_ID;   // bot's application ID
const GUILD_ID    = '1477747478747938907';
const LOG_CHANNEL = '1477840182211252348';
const ALLOWED_ROLES = ['Probationary Police Constable', 'MO19', 'CID'];

// ══════════════════════════════════════════
//  DATA (saved to shifts.json)
// ══════════════════════════════════════════
const DATA_FILE = './shifts.json';

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { active: {}, history: {} }; }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function totalShiftTime(history) {
  return (history || []).reduce((sum, s) => sum + (s.duration || 0), 0);
}

// ══════════════════════════════════════════
//  REGISTER SLASH COMMANDS
// ══════════════════════════════════════════
const commands = [
  new SlashCommandBuilder().setName('onduty').setDescription('Clock on — start your shift'),
  new SlashCommandBuilder().setName('offduty').setDescription('Clock off — end your shift'),
  new SlashCommandBuilder().setName('dutycheck').setDescription('See who is currently on duty'),
  new SlashCommandBuilder().setName('shiftstats').setDescription('Check your total shift time')
    .addUserOption(o => o.setName('user').setDescription('User to check (leave blank for yourself)')),
  new SlashCommandBuilder().setName('shiftboard').setDescription('Top 10 officers by shift time'),
  new SlashCommandBuilder().setName('clearshift').setDescription('Force-end a user\'s shift (admin only)')
    .addUserOption(o => o.setName('user').setDescription('User to clear').setRequired(true)),
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Commands registered.');
  } catch (e) { console.error('Failed to register commands:', e); }
}

// ══════════════════════════════════════════
//  BOT
// ══════════════════════════════════════════
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once('ready', async () => {
  console.log(`✅ Met Shift Bot online as ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const data   = loadData();
  const userId = interaction.user.id;
  const member = interaction.member;
  const guild  = interaction.guild;

  // Check if user has an allowed role
  const hasRole = ALLOWED_ROLES.some(r =>
    member.roles.cache.some(role => role.name === r)
  );

  // ── /onduty ──────────────────────────────
  if (interaction.commandName === 'onduty') {
    if (!hasRole) {
      return interaction.reply({ content: '❌ You need a Met role to go on duty.', ephemeral: true });
    }
    if (data.active[userId]) {
      return interaction.reply({ content: '⚠️ You are already on duty! Use `/offduty` first.', ephemeral: true });
    }

    data.active[userId] = { startTime: Date.now(), username: interaction.user.username };
    saveData(data);

    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('🟢 Officer On Duty')
      .setDescription(`**${interaction.user.username}** has started their shift.`)
      .addFields({ name: 'Started', value: `<t:${Math.floor(Date.now()/1000)}:T>`, inline: true })
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    const logChannel = await guild.channels.fetch(LOG_CHANNEL).catch(() => null);
    if (logChannel) logChannel.send({ embeds: [embed] });

    return interaction.reply({ content: '✅ You are now **on duty**. Stay safe out there!', ephemeral: true });
  }

  // ── /offduty ─────────────────────────────
  if (interaction.commandName === 'offduty') {
    if (!data.active[userId]) {
      return interaction.reply({ content: '⚠️ You are not currently on duty.', ephemeral: true });
    }

    const shift    = data.active[userId];
    const duration = Date.now() - shift.startTime;
    delete data.active[userId];

    if (!data.history[userId]) data.history[userId] = [];
    data.history[userId].push({ startTime: shift.startTime, endTime: Date.now(), duration });
    saveData(data);

    const total = totalShiftTime(data.history[userId]);

    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('🔴 Officer Off Duty')
      .setDescription(`**${interaction.user.username}** has ended their shift.`)
      .addFields(
        { name: 'Duration', value: formatDuration(duration), inline: true },
        { name: 'Total Time', value: formatDuration(total), inline: true }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    const logChannel = await guild.channels.fetch(LOG_CHANNEL).catch(() => null);
    if (logChannel) logChannel.send({ embeds: [embed] });

    return interaction.reply({ content: `✅ Shift ended. Duration: **${formatDuration(duration)}**`, ephemeral: true });
  }

  // ── /dutycheck ───────────────────────────
  if (interaction.commandName === 'dutycheck') {
    const active = Object.entries(data.active);
    if (active.length === 0) {
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(0x6b7280).setTitle('👮 Officers On Duty')
          .setDescription('No officers are currently on duty.')
      ]});
    }

    const lines = active.map(([id, s]) => {
      const dur = formatDuration(Date.now() - s.startTime);
      return `👮 **${s.username}** — on for ${dur}`;
    });

    return interaction.reply({ embeds: [
      new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle(`👮 Officers On Duty (${active.length})`)
        .setDescription(lines.join('\n'))
        .setTimestamp()
    ]});
  }

  // ── /shiftstats ──────────────────────────
  if (interaction.commandName === 'shiftstats') {
    const target = interaction.options.getUser('user') || interaction.user;
    const history = data.history[target.id] || [];
    const total = totalShiftTime(history);
    const count = history.length;
    const onDutyNow = !!data.active[target.id];
    const currentDur = onDutyNow ? Date.now() - data.active[target.id].startTime : 0;

    return interaction.reply({ embeds: [
      new EmbedBuilder()
        .setColor(0xa855f7)
        .setTitle(`📊 Shift Stats — ${target.username}`)
        .addFields(
          { name: 'Total Shifts', value: `${count}`, inline: true },
          { name: 'Total Time', value: formatDuration(total + currentDur), inline: true },
          { name: 'Status', value: onDutyNow ? `🟢 On Duty (${formatDuration(currentDur)})` : '🔴 Off Duty', inline: true }
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp()
    ]});
  }

  // ── /shiftboard ──────────────────────────
  if (interaction.commandName === 'shiftboard') {
    const scores = Object.entries(data.history).map(([id, hist]) => ({
      id,
      username: hist[hist.length - 1]?.username || data.active[id]?.username || 'Unknown',
      total: totalShiftTime(hist) + (data.active[id] ? Date.now() - data.active[id].startTime : 0)
    }));

    scores.sort((a, b) => b.total - a.total);
    const top10 = scores.slice(0, 10);

    if (top10.length === 0) {
      return interaction.reply({ content: 'No shift data yet.', ephemeral: true });
    }

    const medals = ['🥇','🥈','🥉'];
    const lines = top10.map((s, i) =>
      `${medals[i] || `**${i+1}.**`} **${s.username}** — ${formatDuration(s.total)}`
    );

    return interaction.reply({ embeds: [
      new EmbedBuilder()
        .setColor(0xcfb53b)
        .setTitle('🏆 Shift Leaderboard')
        .setDescription(lines.join('\n'))
        .setTimestamp()
    ]});
  }

  // ── /clearshift (admin) ──────────────────
  if (interaction.commandName === 'clearshift') {
    if (!member.permissions.has('ManageRoles')) {
      return interaction.reply({ content: '❌ You need Manage Roles permission.', ephemeral: true });
    }
    const target = interaction.options.getUser('user');
    if (!data.active[target.id]) {
      return interaction.reply({ content: `⚠️ **${target.username}** is not currently on duty.`, ephemeral: true });
    }
    const dur = Date.now() - data.active[target.id].startTime;
    if (!data.history[target.id]) data.history[target.id] = [];
    data.history[target.id].push({ startTime: data.active[target.id].startTime, endTime: Date.now(), duration: dur });
    delete data.active[target.id];
    saveData(data);
    return interaction.reply({ content: `✅ Force-ended **${target.username}**'s shift (${formatDuration(dur)}).` });
  }
});

client.login(BOT_TOKEN);
