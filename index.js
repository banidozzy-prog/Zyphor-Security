const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const unidecode = require('unidecode');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const dbFile = './db.json';
let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { palavras: [] };
function save() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// --- MOTOR DE DETECÇÃO (ANTI-NICK BURLADO + MENSAGENS) ---
function isMalicious(text) {
    // 1. Detecta caracteres invisíveis (burlados) e letras gregas
    const isBurlado = /[\x00-\x1F\x7F-\x9F]/.test(text) || /[\u0370-\u03FF]/.test(text);
    
    // 2. Detecta blacklist + palavras adicionadas
    const limpo = unidecode(text).toLowerCase();
    const blacklist = ['ap gratis', 'link na bio', 'gratis', 'scam', 'vagas', 'lideranca', 'org', 'phishing', 'fake nitro'];
    const todasPalavras = [...blacklist, ...(db.palavras || [])];
    const temPalavraProibida = todasPalavras.some(p => limpo.includes(p.toLowerCase()));
    
    return isBurlado || temPalavraProibida;
}

// --- LOG LOCAL ---
async function sendServerLog(guild, member, type, content) {
    const channel = guild.channels.cache.find(c => c.isTextBased()) || guild.systemChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(type === 'ban' ? 0xFF0000 : 0xFFA500)
        .setTitle(type === 'ban' ? '🚨 BLOQUEIO DE NICK (ANTI-BURLA)' : '💬 MENSAGEM BLOQUEADA')
        .addFields(
            { name: '👤 Usuário', value: member.user.tag, inline: true },
            { name: type === 'ban' ? '📛 Nick' : '📝 Conteúdo', value: content || 'N/A', inline: false }
        )
        .setTimestamp();
    channel.send({ embeds: [embed] }).catch(() => {});
}

// --- EVENTOS ---
client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.guild) return;
    if (isMalicious(msg.content)) {
        await msg.delete().catch(() => {});
        sendServerLog(msg.guild, msg.member, 'msg', msg.content);
    }
});

client.on('guildMemberAdd', async (m) => {
    if (isMalicious(m.displayName)) {
        await m.ban({ reason: 'Zyphor V3: Nick Burlado Detectado' }).catch(() => {});
        sendServerLog(m.guild, m, 'ban', m.displayName);
    }
});

// --- COMANDOS ---
client.on('ready', async () => {
    const commands = [
        { name: 'painel', description: '⚙️ Painel da Staff' },
        { name: 'addpalavra', description: '➕ Adicionar palavra', options: [{ name: 'palavras', type: 3, required: true, description: 'Ex: fdp,pnc' }] }
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ ZYPHOR V3 ATIVO - PROTEÇÃO ANTI-BURLA ATIVA');
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    if (i.commandName === 'addpalavra') {
        const novas = i.options.getString('palavras').split(',');
        db.palavras = [...(db.palavras || []), ...novas];
        save();
        i.reply({ content: '✅ Palavras adicionadas à proteção.', ephemeral: true });
    }
    if (i.commandName === 'painel') i.reply({ content: '⚙️ Painel do ZYPHOR V3 operacional.', ephemeral: true });
});

client.login(TOKEN);
