const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const unidecode = require('unidecode');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const dbFile = './db.json';
let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { palavras: [], logs: { msg: '', ban: '' } };
function save() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// --- LÓGICA DE DETECÇÃO ---
function isMalicious(text) {
    const limpo = unidecode(text).toLowerCase();
    const blacklist = ['ap gratis', 'link na bio', 'gratis', 'scam', 'vagas', 'lideranca', 'org', 'phishing', 'fake nitro'];
    return [...blacklist, ...db.palavras].some(p => limpo.includes(p.toLowerCase())) || /[\x00-\x1F\x7F-\x9F]/.test(text);
}

// --- LOGS ---
async function sendLog(guild, member, type, content) {
    const channelId = db.logs[type];
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(type === 'ban' ? 0xFF0000 : 0xFFA500)
        .setTitle(type === 'ban' ? '🚨 BAN AUTOMÁTICO' : '💬 MENSAGEM BLOQUEADA')
        .addFields(
            { name: '👤 Usuário', value: member.user.tag, inline: true },
            { name: type === 'ban' ? '📛 Nick' : '📝 Conteúdo', value: content || 'N/A', inline: false }
        ).setTimestamp();
    channel.send({ embeds: [embed] }).catch(() => {});
}

// --- COMANDOS ---
client.on('ready', async () => {
    const commands = [
        { name: 'painel', description: '⚙️ Painel da Staff' },
        { name: 'addpalavra', description: '➕ Add palavra', options: [{ name: 'palavra', type: 3, required: true, description: 'Palavra' }] },
        { name: 'remover', description: '➖ Remover palavra', options: [{ name: 'palavra', type: 3, required: true, description: 'Palavra' }] },
        { name: 'verpalavras', description: '📜 Ver lista' },
        { name: 'setlog', description: '📑 Configurar logs', options: [
            { name: 'tipo', type: 3, required: true, choices: [{name:'Mensagens', value:'msg'}, {name:'Bans', value:'ban'}], description: 'Tipo' },
            { name: 'canal', type: 7, required: true, description: 'Canal' }
        ]}
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ ZYPHOR V3 ATIVO');
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;

    // --- PAINEL STAFF (Respondendo para não dar erro) ---
    if (i.commandName === 'painel') {
        const embed = new EmbedBuilder().setTitle('⚙️ Painel de Segurança Zyphor V3').setDescription('O sistema de proteção está ativo e monitorando nicks e mensagens.');
        return i.reply({ embeds: [embed], ephemeral: true });
    }

    // --- GERENCIAR PALAVRAS ---
    if (i.commandName === 'addpalavra') {
        db.palavras.push(i.options.getString('palavra').toLowerCase());
        save();
        return i.reply({ content: '✅ Palavra adicionada.', ephemeral: true });
    }

    if (i.commandName === 'remover') {
        const p = i.options.getString('palavra').toLowerCase();
        db.palavras = db.palavras.filter(word => word !== p);
        save();
        return i.reply({ content: '✅ Palavra removida.', ephemeral: true });
    }

    if (i.commandName === 'verpalavras') {
        const lista = db.palavras.length > 0 ? db.palavras.join(', ') : 'Nenhuma.';
        return i.reply({ content: `📜 **Palavras proibidas:** ${lista}`, ephemeral: true });
    }

    // --- SETLOG ---
    if (i.commandName === 'setlog') {
        db.logs[i.options.getString('tipo')] = i.options.getChannel('canal').id;
        save();
        return i.reply({ content: '✅ Log configurado.', ephemeral: true });
    }
});

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

client.login(TOKEN);

