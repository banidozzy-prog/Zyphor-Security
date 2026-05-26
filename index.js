const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const unidecode = require('unidecode');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const dbFile = './db.json';
let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { palavras: [], logs: { msg: '', ban: '' } };
function save() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

function isMalicious(text) {
    const limpo = unidecode(text).toLowerCase();
    const blacklist = ['ap gratis', 'link na bio', 'gratis', 'scam', 'vagas', 'lideranca', 'org', 'phishing', 'fake nitro'];
    return [...blacklist, ...db.palavras].some(p => limpo.includes(p.toLowerCase())) || /[\x00-\x1F\x7F-\x9F]/.test(text);
}

// --- LOG PERSONALIZADA ---
async function sendLog(guild, member, type, content) {
    const channelId = db.logs[type];
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(type === 'ban' ? 0xFF0000 : 0xFFA500)
        .setTitle(type === 'ban' ? '🚨 BAN AUTOMÁTICO (ANTI-BURLA)' : '💬 MENSAGEM BLOQUEADA')
        .addFields(
            { name: '👤 Usuário', value: member.user.tag, inline: true },
            { name: type === 'ban' ? '📛 Nick Detectado' : '📝 Conteúdo', value: content || 'N/A', inline: false }
        )
        .setTimestamp();
    channel.send({ embeds: [embed] }).catch(() => {});
}

// --- EVENTOS ---
client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.guild) return;
    if (isMalicious(msg.content)) {
        await msg.delete().catch(() => {});
        sendLog(msg.guild, msg.member, 'msg', msg.content);
    }
});

client.on('guildMemberAdd', async (m) => {
    if (isMalicious(m.displayName)) {
        await m.ban({ reason: 'Zyphor V3: Nick Burlado' }).catch(() => {});
        sendLog(m.guild, m, 'ban', m.displayName);
    }
});

// --- COMANDOS ---
client.on('ready', async () => {
    const commands = [
        { name: 'painel', description: '⚙️ Painel da Staff' },
        { name: 'addpalavra', description: '➕ Adicionar palavra', options: [{ name: 'palavras', type: 3, required: true, description: 'Ex: fdp,pnc' }] },
        { name: 'setlog', description: '📑 Define canais de log', options: [
            { name: 'tipo', type: 3, required: true, description: 'Tipo de log', choices: [{name:'Mensagens', value:'msg'}, {name:'Bans', value:'ban'}] },
            { name: 'canal', type: 7, required: true, description: 'Marque o canal' }
        ]}
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: commands });
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    
    if (i.commandName === 'setlog') {
        const tipo = i.options.getString('tipo');
        db.logs[tipo] = i.options.getChannel('canal').id;
        save();
        i.reply({ content: `✅ Log de **${tipo}** configurado para <#${db.logs[tipo]}>`, ephemeral: true });
    }
    
    if (i.commandName === 'addpalavra') {
        const novas = i.options.getString('palavras').split(',');
        db.palavras = [...(db.palavras || []), ...novas];
        save();
        i.reply({ content: '✅ Palavras adicionadas.', ephemeral: true });
    }
});

client.login(TOKEN);
