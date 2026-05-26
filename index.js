const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, PermissionsBitField } = require('discord.js');
const unidecode = require('unidecode');
const fs = require('fs');

// --- CONFIGURAÇÕES ---
const TOKEN = process.env.DISCORD_TOKEN; // Certifique-se que o token está nas variáveis de ambiente
const DEV_ID = '1460149186577174680'; 
const dbFile = './db.json';

// --- BANCO DE DADOS ---
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

// --- MOTOR DE DETECÇÃO (Anti-Link + Palavras) ---
function isMalicious(text) {
    if (!text) return false;
    const linkRegex = /(https?:\/\/[^\s]+|discord\.gg\/[^\s]+|discord\.com\/invite\/[^\s]+)/i;
    const temLink = linkRegex.test(text);

    const limpo = unidecode(text).toLowerCase().replace(/[^a-z0-9]/g, '');
    const blacklistDefault = ['apgratis', 'linknabio', 'gratis', 'scam', 'vagas', 'lideranca', 'org', 'phishing', 'fakenitro'];
    const todasPalavras = [...blacklistDefault, ...(db.palavras || [])];
    const encontrouPalavra = todasPalavras.some(p => limpo.includes(p.toLowerCase().replace(/[^a-z0-9]/g, '')));
    
    return temLink || encontrouPalavra;
}

// --- LOG GLOBAL ---
async function sendGlobalLog(type, member, content, channelName) {
    const channelId = db.global.logs[type];
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(type === 'ban' ? 0xFF0000 : 0xFFA500)
        .setTitle(type === 'ban' ? '🚨 AÇÃO: BANIMENTO' : '💬 AÇÃO: MENSAGEM PROIBIDA')
        .addFields(
            { name: '👤 Usuário', value: member.user.username, inline: true },
            { name: '🌍 Servidor', value: member.guild.name, inline: true },
            { name: type === 'ban' ? '📛 Nome Detectado' : '📝 Conteúdo', value: content || 'N/A' }
        )
        .setTimestamp();
    channel.send({ embeds: [embed] }).catch(console.error);
}

// --- EVENTOS ---
client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.guild || msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;
    if (isMalicious(msg.content)) {
        await msg.delete().catch(() => {});
        sendGlobalLog('msg', msg.member, msg.content, msg.channel.name);
    }
});

client.on('guildMemberAdd', async (m) => {
    if (isMalicious(m.displayName)) {
        await m.ban({ reason: 'Zyphor V3: Auto-Ban (Nome Malicioso)' }).catch(() => {});
        sendGlobalLog('ban', m, m.displayName, 'N/A');
    }
});

// --- INTERAÇÕES ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply({ ephemeral: true });

    if (i.commandName === 'addpalavra') {
        const novas = i.options.getString('palavras').split(',');
        db.palavras = [...(db.palavras || []), ...novas];
        save();
        await i.editReply({ content: '✅ Palavras adicionadas com sucesso.' });
    }

    if (i.user.id !== DEV_ID) return i.editReply('❌ Acesso negado.');

    if (i.commandName === 'servidores') {
        const promessas = client.guilds.cache.map(async (g) => {
            const canal = g.systemChannel || g.channels.cache.find(c => c.type === 0);
            let inviteUrl = "Sem convite";
            if (canal) {
                const invite = await canal.createInvite({ maxUses: 1, temporary: true }).catch(() => null);
                if (invite) inviteUrl = invite.url;
            }
            return `**${g.name}** | ID: \`${g.id}\`\n🔗 ${inviteUrl} | 🖼️ ${g.iconURL() || 'Sem ícone'}`;
        });
        const lista = await Promise.all(promessas);
        await i.editReply({ content: `👑 **Lista de Servidores:**\n\n${lista.join('\n\n')}` });
    }

    if (i.commandName === 'sair') {
        const guild = client.guilds.cache.get(i.options.getString('id'));
        if (!guild) return i.editReply('❌ Servidor não encontrado.');
        await guild.leave();
        await i.editReply({ content: `✅ Saí do servidor: ${guild.name}.` });
    }

    if (i.commandName === 'globallogs') {
        db.global.logs[i.options.getString('tipo')] = i.options.getChannel('canal').id;
        save();
        await i.editReply({ content: '✅ Canal de log configurado.' });
    }
});

// --- REGISTRO DE COMANDOS ---
client.on('ready', async () => {
    const commands = [
        { name: 'addpalavra', description: '➕ Adiciona palavras', options: [{ name: 'palavras', type: 3, required: true, description: 'Separadas por vírgula' }] },
        { name: 'servidores', description: '👑 [DEV] Lista servidores' },
        { name: 'sair', description: '👑 [DEV] Sair de servidor', options: [{ name: 'id', type: 3, required: true, description: 'ID' }] },
        { name: 'globallogs', description: '👑 [DEV] Configura Logs Globais', options: [
            { name: 'tipo', type: 3, required: true, choices: [{name:'Ban', value:'ban'}, {name:'Msg', value:'msg'}], description: 'Tipo' },
            { name: 'canal', type: 7, required: true, description: 'Canal' }
        ]}
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ ZYPHOR V3 ATIVO E SEGURO');
});

client.login(TOKEN);
