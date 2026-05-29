const { 
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes, InteractionResponseFlags 
} = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';
const dbFile = './db.json';

// Inicialização do Banco
let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { 
    palavras: [], logs: { msg: '', ban: '', cargo: '' } 
};
const save = () => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildVoiceStates
    ] 
});

// Funções de Proteção
const isMalicious = (text) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    const blacklist = ['apgratis', 'linknabio', 'gratis', 'scam', 'vagas', 'phishing', ...db.palavras];
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|\b\w+\.\w{2,}\/\S+)/i;
    return urlRegex.test(text) || blacklist.some(p => lower.includes(p.toLowerCase()));
};

const sendLog = async (guild, member, type, content) => {
    const channel = guild.channels.cache.get(db.logs[type]);
    if (!channel) return;
    const embed = new EmbedBuilder()
        .setColor(type === 'ban' ? 0xFF0000 : 0x00FF00)
        .setTitle(`🛡️ Log: ${type.toUpperCase()}`)
        .addFields({ name: 'Usuário', value: member.user.tag, inline: true }, { name: 'Detalhes', value: content })
        .setTimestamp();
    channel.send({ embeds: [embed] }).catch(() => {});
};

// Registro de Comandos
client.once('clientReady', async (c) => {
    const commands = [
        { name: 'servidores', description: 'Lista servidores' },
        { name: 'setlog', description: 'Configurar log', options: [
            { name: 'tipo', type: 3, required: true, choices: [{name:'Mensagens', value:'msg'}, {name:'Bans', value:'ban'}, {name:'Cargos', value:'cargo'}], description: 'Tipo' },
            { name: 'canal', type: 7, required: true, description: 'Canal' }
        ]},
        { name: 'addpalavra', description: 'Add palavra', options: [{ name: 'palavra', type: 3, required: true, description: 'Ex: fdp,pnc' }] },
        { name: 'remover', description: 'Remover', options: [{ name: 'palavra', type: 3, required: true, description: 'Palavra' }] },
        { name: 'verpalavras', description: 'Listar palavras' },
        { name: 'sair', description: 'Sair de servidor', options: [{ name: 'id', type: 3, required: true, description: 'ID' }] }
    ];

    try {
        await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(c.user.id), { body: commands });
        console.log(`✅ Zyphor V3 online como ${c.user.tag} | Comandos registrados.`);
    } catch (e) { console.error('❌ Falha ao registrar:', e); }
});

// Interações
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply({ flags: [InteractionResponseFlags.Ephemeral] });

    if (i.commandName === 'setlog') {
        db.logs[i.options.getString('tipo')] = i.options.getChannel('canal').id;
        save();
        i.editReply('✅ Log atualizado.');
    } else if (i.commandName === 'addpalavra') {
        const words = i.options.getString('palavra').split(',').map(p => p.trim().toLowerCase());
        words.forEach(p => { if (!db.palavras.includes(p)) db.palavras.push(p); });
        save();
        i.editReply(`✅ Palavras salvas: ${words.join(', ')}`);
    } else if (i.commandName === 'verpalavras') {
        i.editReply(`📜 **Palavras:** ${db.palavras.join(', ') || 'Vazia'}`);
    } else if (i.commandName === 'sair' && i.user.id === DEV_ID) {
        const g = client.guilds.cache.get(i.options.getString('id'));
        if (g) { await g.leave(); i.editReply('🚪 Saiu.'); } else i.editReply('❌ Servidor não encontrado.');
    }
});

// Eventos de Segurança
client.on('messageCreate', (m) => {
    if (m.author.bot || !m.guild) return;
    if (isMalicious(m.content)) { m.delete().catch(() => {}); sendLog(m.guild, m.member, 'msg', 'Mensagem bloqueada.'); }
});

client.on('guildMemberUpdate', (oldM, newM) => {
    if (oldM.displayName !== newM.displayName && isMalicious(newM.displayName)) newM.ban({ reason: 'Nick malicioso' });
});

client.login(TOKEN);
