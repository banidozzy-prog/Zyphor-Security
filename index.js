const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const unidecode = require('unidecode');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';
const dbFile = './db.json';
let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { global: { logs: { ban: '', msg: '' } }, palavras: [] };
function save() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// --- MOTOR DE DETECÇÃO ---
function isMalicious(text) {
    const limpo = unidecode(text).toLowerCase();
    const blacklistDefault = ['ap gratis', 'link na bio', 'gratis', 'scam', 'vagas', 'lideranca', 'org', 'phishing', 'fake nitro'];
    const todasPalavras = [...blacklistDefault, ...(db.palavras || [])];
    return todasPalavras.some(p => limpo.includes(p.toLowerCase())) || /[\x00-\x1F\x7F-\x9F]/.test(text);
}

// --- LOG GLOBAL ---
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

// --- REGISTRO DE COMANDOS ---
client.on('ready', async () => {
    const commands = [
        { name: 'painel', description: '⚙️ Painel da Staff' },
        { name: 'addpalavra', description: '➕ Adiciona palavras', options: [{ name: 'palavras', type: 3, required: true, description: 'Palavras separadas por virgula' }] },
        { name: 'verpalavras', description: '📜 Lista palavras proibidas' },
        { name: 'configurar', description: '⚙️ Configura canais' },
        { name: 'logs', description: '📑 Gerencia logs' },
        { name: 'antiraid', description: '🛡️ Ativa Anti-Raid' },
        { name: 'antilink', description: '🚫 Gerencia Anti-Link' },
        { name: 'antispam', description: '⚠️ Configura Anti-Spam' },
        { name: 'globallogs', description: '👑 Configura Logs Globais', options: [{ name: 'tipo', type: 3, required: true, choices: [{name:'Ban', value:'ban'}, {name:'Msg', value:'msg'}], description: 'Tipo' }, { name: 'canal', type: 7, required: true, description: 'Canal' }] },
        { name: 'servidores', description: '👑 Lista servidores' },
        { name: 'sair', description: '👑 Sai de um servidor', options: [{ name: 'id', type: 3, required: true, description: 'ID do servidor' }] }
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ ZYPHOR V3 ATIVO E COMANDOS REGISTRADOS');
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
