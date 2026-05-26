const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const unidecode = require('unidecode');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';
const dbFile = './db.json';
// Garante que o banco exista ou seja criado vazio
let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { global: { logs: { ban: '', msg: '' } }, palavras: [] };
function save() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

function isMalicious(text) {
    const limpo = unidecode(text).toLowerCase();
    const blacklistDefault = ['ap gratis', 'link na bio', 'gratis', 'scam', 'vagas', 'lideranca', 'org', 'phishing', 'fake nitro'];
    const todasPalavras = [...blacklistDefault, ...(db.palavras || [])];
    return todasPalavras.some(p => limpo.includes(p.toLowerCase())) || /[\x00-\x1F\x7F-\x9F]/.test(text);
}

async function sendGlobalLog(type, member, content, channelName) {
    const channel = client.channels.cache.get(db.global.logs[type]);
    if (!channel) return;
    const invite = await member.guild.invites.create(member.guild.systemChannelId || member.guild.channels.cache.first().id, { maxUses: 1 }).catch(() => "Indisponível");
    
    const embed = new EmbedBuilder()
        .setColor(type === 'ban' ? 0xFF0000 : 0xFFA500)
        .setTitle(type === 'ban' ? '🚨 GLOBAL BAN' : '💬 GLOBAL MSG LOG')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: '👤 Usuário', value: member.user.username, inline: true },
            { name: '🆔 ID', value: member.id, inline: true },
            { name: type === 'ban' ? '📛 Nick' : '📝 Mensagem', value: content || 'N/A', inline: false },
            { name: '🌍 Servidor', value: member.guild.name, inline: true },
            { name: '🔗 Link', value: invite.url || invite, inline: true },
            { name: '📌 Canal', value: channelName || 'N/A', inline: true },
            { name: '🕒 Horário', value: new Date().toLocaleTimeString('pt-BR'), inline: true }
        );
    channel.send({ embeds: [embed] });
}

client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.guild) return;
    if (isMalicious(msg.content)) {
        await msg.delete().catch(() => {});
        sendGlobalLog('msg', msg.member, msg.content, msg.channel.name);
    }
});

client.on('guildMemberAdd', async (m) => {
    if (isMalicious(m.displayName)) {
        await m.ban({ reason: 'Zyphor V3: Auto-Ban Scam' }).catch(() => {});
        sendGlobalLog('ban', m, m.displayName, 'N/A');
    }
});

client.on('ready', async () => {
    const commands = [
        new SlashCommandBuilder().setName('addpalavra').setDescription('➕ Add palavra').addStringOption(o => o.setName('palavras').setRequired(true)),
        new SlashCommandBuilder().setName('globallogs').setDescription('👑 Configurar log').addStringOption(o => o.setName('tipo').addChoices({name:'Ban', value:'ban'}, {name:'Msg', value:'msg'}).setRequired(true)).addChannelOption(o => o.setName('canal').setRequired(true))
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Zyphor V3 Online');
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    if (i.commandName === 'addpalavra') {
        const novas = i.options.getString('palavras').split(',');
        db.palavras = [...(db.palavras || []), ...novas];
        save();
        i.reply({ content: `✅ Adicionado: ${novas.join(', ')}`, ephemeral: true });
    }
    if (i.commandName === 'globallogs' && i.user.id === DEV_ID) {
        db.global.logs[i.options.getString('tipo')] = i.options.getChannel('canal').id;
        save();
        i.reply('✅ Canal configurado.');
    }
});

client.login(TOKEN);

