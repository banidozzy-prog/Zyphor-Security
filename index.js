const { Client, GatewayIntentBits, REST, Routes, PermissionsBitField, EmbedBuilder } = require('discord.js');
const unidecode = require('unidecode');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = '1507876666146291772';
const DEV_ID = '1460149186577174680';
const dbFile = './db.json';

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

function isMalicious(text) {
    if (!text) return false;
    const linkRegex = /(https?:\/\/[^\s]+|discord\.gg\/[^\s]+|discord\.com\/invite\/[^\s]+)/i;
    const limpo = unidecode(text).toLowerCase().replace(/[^a-z0-9]/g, '');
    const blacklistDefault = ['apgratis', 'linknabio', 'gratis', 'scam', 'vagas', 'lideranca', 'org', 'phishing', 'fakenitro'];
    const todasPalavras = [...blacklistDefault, ...(db.palavras || [])];
    const encontrouPalavra = todasPalavras.some(p => limpo.includes(p.toLowerCase().replace(/[^a-z0-9]/g, '')));
    return linkRegex.test(text) || encontrouPalavra;
}

async function sendGlobalLog(type, member, content) {
    const channel = client.channels.cache.get(db.global.logs[type]);
    if (!channel) return;
    const embed = new EmbedBuilder()
        .setColor(type === 'ban' ? 0xFF0000 : 0xFFA500)
        .setTitle(type === 'ban' ? '🚨 BANIMENTO AUTOMÁTICO' : '💬 MENSAGEM PROIBIDA')
        .addFields(
            { name: '👤 Usuário', value: member.user.username, inline: true },
            { name: '🌍 Servidor', value: member.guild.name, inline: true },
            { name: '📛 Conteúdo/Nome', value: content || 'N/A' }
        ).setTimestamp();
    channel.send({ embeds: [embed] }).catch(console.error);
}

client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.guild || msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;
    if (isMalicious(msg.content)) {
        await msg.delete().catch(() => {});
        sendGlobalLog('msg', msg.member, msg.content);
    }
});

client.on('guildMemberAdd', async (m) => {
    await m.fetch().catch(() => {});
    if (isMalicious(m.displayName)) {
        await m.ban({ reason: 'Zyphor V3: Auto-Ban' }).catch(e => console.log("Erro ban:", e));
        sendGlobalLog('ban', m, m.displayName);
    }
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply({ ephemeral: true });

    if (i.commandName === 'addpalavra') {
        const novas = i.options.getString('palavras').split(',');
        db.palavras = [...(db.palavras || []), ...novas];
        save();
        return i.editReply({ content: '✅ Palavras adicionadas.' });
    }

    if (i.user.id !== DEV_ID) return i.editReply('❌ Acesso negado.');

    if (i.commandName === 'servidores') {
        const lista = client.guilds.cache.map(g => `**${g.name}** | ID: \`${g.id}\` | 🖼️ ${g.iconURL() || 'Sem ícone'}`).join('\n');
        return i.editReply({ content: `👑 **Servidores:**\n\n${lista}` });
    }

    if (i.commandName === 'sair') {
        const guild = client.guilds.cache.get(i.options.getString('id'));
        if (!guild) return i.editReply('❌ Servidor não encontrado.');
        await guild.leave();
        return i.editReply({ content: `✅ Saí de ${guild.name}.` });
    }

    if (i.commandName === 'globallogs') {
        db.global.logs[i.options.getString('tipo')] = i.options.getChannel('canal').id;
        save();
        return i.editReply({ content: '✅ Canal configurado.' });
    }
});

client.once('clientReady', async (c) => {
    console.log(`✅ ZYPHOR V3 ATIVO em ${c.user.tag}`);
    const commands = [
        { name: 'addpalavra', description: '➕ Adiciona palavras', options: [{ name: 'palavras', type: 3, required: true, description: 'Separadas por vírgula' }] },
        { name: 'servidores', description: '👑 [DEV] Lista servidores' },
        { name: 'sair', description: '👑 [DEV] Sair de servidor', options: [{ name: 'id', type: 3, required: true, description: 'ID' }] },
        { name: 'globallogs', description: '👑 [DEV] Configura Logs', options: [
            { name: 'tipo', type: 3, required: true, choices: [{name:'Ban', value:'ban'}, {name:'Msg', value:'msg'}], description: 'Tipo' },
            { name: 'canal', type: 7, required: true, description: 'Canal' }
        ]}
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(APP_ID), { body: commands });
});

client.login(TOKEN);

