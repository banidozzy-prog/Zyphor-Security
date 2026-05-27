const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const unidecode = require('unidecode');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680'; 
const dbFile = './db.json';

let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { 
    palavras: [], 
    logs: { msg: '', ban: '' },
    stats: {} 
};

function save() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// --- MOTOR DE DETECÇÃO ---
function isMalicious(text) {
    const isBurlado = /[\x00-\x1F\x7F-\x9F]/.test(text) || /[\u0370-\u03FF]/.test(text);
    const limpo = unidecode(text).toLowerCase();
    const blacklistDefault = ['ap gratis', 'link na bio', 'gratis', 'scam', 'vagas', 'lideranca', 'org', 'phishing', 'fake nitro'];
    const todasPalavras = [...blacklistDefault, ...db.palavras];
    const temPalavraProibida = todasPalavras.some(p => limpo.includes(p.toLowerCase()));
    return isBurlado || temPalavraProibida;
}

// --- LOGS ---
async function sendLog(guild, member, type, content) {
    if (!db.stats[guild.id]) db.stats[guild.id] = { bans: 0, msgs: 0, nome: guild.name };
    db.stats[guild.id][type === 'ban' ? 'bans' : 'msgs']++;
    save();

    const channel = guild.channels.cache.get(db.logs[type]);
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
        { name: 'addpalavra', description: '➕ Adicionar (use vírgula)', options: [{ name: 'palavra', type: 3, required: true, description: 'Ex: fdp,macaco' }] },
        { name: 'remover', description: '➖ Remover palavra', options: [{ name: 'palavra', type: 3, required: true, description: 'Palavra' }] },
        { name: 'verpalavras', description: '📜 Ver lista' },
        { name: 'servidores', description: '👑 Painel DEV de estatísticas' },
        { name: 'setlog', description: '📑 Configurar logs', options: [
            { name: 'tipo', type: 3, required: true, choices: [{name:'Mensagens', value:'msg'}, {name:'Bans', value:'ban'}], description: 'Tipo' },
            { name: 'canal', type: 7, required: true, description: 'Canal' }
        ]}
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ ZYPHOR V3 ATIVO E RESPONDENDO');
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply({ ephemeral: true });

    try {
        if (i.commandName === 'servidores') {
            if (i.user.id !== DEV_ID) return i.editReply({ content: '❌ Acesso negado.' });
            const lista = Object.entries(db.stats).map(([id, s]) => `**${s.nome}**\nID: \`${id}\`\n🚫 Bans: ${s.bans} | 💬 Msgs: ${s.msgs}`).join('\n\n');
            await i.editReply({ embeds: [new EmbedBuilder().setTitle('👑 Painel DEV').setDescription(lista || 'Sem dados.')] });
        }
        else if (i.commandName === 'painel') {
            await i.editReply({ content: '⚙️ **Painel Zyphor V3**\nProteção Anti-Burla ativa.' });
        }
        else if (i.commandName === 'addpalavra') {
            const novas = i.options.getString('palavra').split(',').map(p => p.trim().toLowerCase());
            novas.forEach(p => { if (!db.palavras.includes(p)) db.palavras.push(p); });
            save();
            await i.editReply({ content: `✅ Adicionado: ${novas.join(', ')}` });
        }
        else if (i.commandName === 'remover') {
            const p = i.options.getString('palavra').toLowerCase();
            db.palavras = db.palavras.filter(w => w !== p);
            save();
            await i.editReply({ content: `✅ Removido: ${p}` });
        }
        else if (i.commandName === 'verpalavras') {
            await i.editReply({ content: `📜 **Lista:** ${db.palavras.join(', ') || 'Vazia'}` });
        }
        else if (i.commandName === 'setlog') {
            db.logs[i.options.getString('tipo')] = i.options.getChannel('canal').id;
            save();
            await i.editReply({ content: '✅ Canal configurado!' });
        }
    } catch (e) { await i.editReply({ content: '❌ Erro.' }); }
});

client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.guild) return;
    if (isMalicious(msg.content)) {
        await msg.delete().catch(() => {});
        sendLog(msg.guild, msg.member, 'msg', msg.content);
    }
});

client.on('guildMember

