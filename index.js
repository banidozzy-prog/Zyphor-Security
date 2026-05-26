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
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

// Filtro agressivo: remove tudo, converte símbolos/letras gregas/fontes em texto simples
function isMalicious(text) {
    if (!text) return false;
    let limpo = unidecode(text).toLowerCase().replace(/[^a-z0-9]/g, '');
    const blacklist = ['1apgratis', 'linknabio', 'gratis', 'scam', 'vagas', 'lideranca', 'phishing', 'fakenitro', 'discordgg', ...db.palavras];
    return blacklist.some(p => limpo.includes(p.toLowerCase().replace(/[^a-z0-9]/g, '')));
}

async function banir(member, motivo) {
    if (member.id === DEV_ID) return;
    try {
        await member.ban({ reason: `Zyphor V3: ${motivo}` });
        const channel = client.channels.cache.get(db.global.logs.ban);
        if (channel) {
            const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('🚨 BANIMENTO AUTOMÁTICO')
                .addFields({ name: 'Usuário', value: member.user.tag }, { name: 'Motivo', value: motivo });
            channel.send({ embeds: [embed] }).catch(() => {});
        }
    } catch (e) { console.log(`Erro ao banir ${member.user.tag}: ${e.message}`); }
}

client.on('guildMemberAdd', async (m) => {
    await m.fetch().catch(() => {});
    if (isMalicious(m.displayName)) await banir(m, 'Nome Malicioso (Entrada)');
});

client.on('guildMemberUpdate', async (oldM, newM) => {
    if (oldM.displayName !== newM.displayName && isMalicious(newM.displayName)) await banir(newM, 'Nome Malicioso (Mudança)');
});

client.on('voiceStateUpdate', async (oldS, newS) => {
    if (newS.channelId && newS.member && isMalicious(newS.member.displayName)) await banir(newS.member, 'Nome Malicioso (Call)');
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply({ ephemeral: true });
    if (i.commandName === 'addpalavra') {
        db.palavras.push(...i.options.getString('palavras').split(','));
        save();
        return i.editReply('✅ Palavras adicionadas.');
    }
    if (i.user.id !== DEV_ID) return i.editReply('❌ Acesso negado.');
    if (i.commandName === 'servidores') return i.editReply(client.guilds.cache.map(g => g.name).join('\n'));
    if (i.commandName === 'globallogs') {
        db.global.logs[i.options.getString('tipo')] = i.options.getChannel('canal').id;
        save();
        return i.editReply('✅ Canal configurado.');
    }
});

client.once('clientReady', async (c) => {
    console.log(`✅ ZYPHOR V3 ATIVO em ${c.user.tag}`);
    const cmds = [
        { name: 'addpalavra', description: '➕', options: [{ name: 'palavras', type: 3, required: true, description: '...' }] },
        { name: 'servidores', description: '👑' },
        { name: 'globallogs', description: '👑', options: [{ name: 'tipo', type: 3, required: true, choices: [{name:'Ban', value:'ban'}]}, { name: 'canal', type: 7, required: true }] }
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(APP_ID), { body: cmds });
});

client.login(TOKEN);

