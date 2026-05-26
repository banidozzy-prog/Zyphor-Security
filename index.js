const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const unidecode = require('unidecode');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';
const dbFile = './db.json';

// Carrega banco ou inicia vazio
let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { global: { logs: { ban: '', msg: '' } }, palavras: [] };
function save() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

// --- MOTOR DE DETECÇÃO ---
function isMalicious(text) {
    const limpo = unidecode(text).toLowerCase();
    const padrao = ['ap gratis', 'link na bio', 'gratis', 'scam', 'vagas', 'lideranca', 'org', 'phishing', 'fake nitro'];
    const total = [...padrao, ...(db.palavras || [])];
    return total.some(p => limpo.includes(p.toLowerCase())) || /[\x00-\x1F\x7F-\x9F]/.test(text);
}

// --- LOG GLOBAL (FORMATO FIEL) ---
async function sendGlobalLog(type, member, content, channelName) {
    const channel = client.channels.cache.get(db.global.logs[type]);
    if (!channel) return;
    
    const embed = new EmbedBuilder()
        .setColor(type === 'ban' ? 0xFF0000 : 0xFFA500)
        .setTitle(type === 'ban' ? '🚨 GLOBAL BAN' : '💬 GLOBAL MSG LOG')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: '👤 Usuário', value: member.user.username, inline: true },
            { name: '🆔 ID', value: member.id, inline: true },
            { name: type === 'ban' ? '📛 Nick' : '📝 Mensagem', value: content || 'N/A', inline: false },
            { name: '🌍 Servidor', value: member.guild.name, inline: true },
            { name: '📌 Canal', value: channelName || 'N/A', inline: true },
            { name: '🕒 Horário', value: new Date().toLocaleTimeString('pt-BR'), inline: true }
        );
    channel.send({ embeds: [embed] });
}

// --- EVENTOS ---
client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.guild) return;
    if (isMalicious(msg.content)) {
        await msg.delete().catch(() => {});
        sendGlobalLog('msg', msg.member, msg.content, msg.channel.name);
    }
});

client.on('guildMemberAdd', async (m) => {
    if (isMalicious(m.displayName)) {
        await m.ban({ reason: 'Zyphor V3: Auto-Ban' }).catch(() => {});
        sendGlobalLog('ban', m, m.displayName, 'N/A');
    }
});

// --- REGISTRO DE COMANDOS (LIMPO E SEM ERROS) ---
client.on('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    const commands = [
        new SlashCommandBuilder().setName('painel').setDescription('⚙️ Painel da staff'),
        new SlashCommandBuilder().setName('addpalavra').setDescription('➕ Adiciona palavras').addStringOption(o => o.setName('palavras').setDescription('Palavras separadas por virgula').setRequired(true)),
        new SlashCommandBuilder().setName('globallogs').setDescription('👑 Configura log global').addStringOption(o => o.setName('tipo').setDescription('Ban ou Msg').setRequired(true).addChoices({name:'Ban', value:'ban'}, {name:'Msg', value:'msg'})).addChannelOption(o => o.setName('canal').setDescription('Canal de logs').setRequired(true))
    ];
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ ZYPHOR V3 ON');
});

// --- INTERAÇÕES ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    if (i.commandName === 'addpalavra') {
        const novas = i.options.getString('palavras').split(',');
        db.palavras = [...(db.palavras || []), ...novas];
        save();
        i.reply({ content: '✅ Palavras adicionadas.', ephemeral: true });
    }
    if (i.commandName === 'globallogs' && i.user.id === DEV_ID) {
        db.global.logs[i.options.getString('tipo')] = i.options.getChannel('canal').id;
        save();
        i.reply('✅ Log configurado.');
    }
});

client.login(TOKEN);
