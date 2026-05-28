const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const unidecode = require('unidecode');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';
const dbFile = './db.json';

const E = { proibido: '🚫', confirmar: '✅', cancelar: '❌', msgs: '💬', id: '🆔', doc: '📄', hora: '⏳' };

let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { 
    palavras: [], logs: { msg: '', ban: '', cargo: '' }, stats: {} 
};

function save() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const client = new Client({ intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, 
    GatewayIntentBits.GuildVoiceStates
]});

function isMalicious(text) {
    const isBurlado = /[\x00-\x1F\x7F-\x9F]/.test(text) || /[\u0370-\u03FF]/.test(text) || /[\u1D00-\u1D7F]/.test(text);
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|\b\w+\.\w{2,}\/\S+)/i;
    const limpo = unidecode(text).toLowerCase().replace(/[^a-z0-9]/g, '');
    const blacklistDefault = ['apgratis', 'linknabio', 'gratis', 'scam', 'vagas', 'lideranca', 'org', 'phishing', 'fakenitro'];
    const todasPalavras = [...blacklistDefault, ...db.palavras.map(p => p.replace(/[^a-z0-9]/g, ''))];
    return isBurlado || urlRegex.test(text) || todasPalavras.some(p => limpo.includes(p));
}

async function crossBan(userId, reason) {
    client.guilds.cache.forEach(async (guild) => {
        try {
            const member = await guild.members.fetch(userId);
            if (member && member.bannable) await member.ban({ reason: `Zyphor V3 CrossBan: ${reason}` });
        } catch (e) {}
    });
}

async function sendLog(guild, member, type, content) {
    const channel = guild.channels.cache.get(db.logs[type]);
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor(type === 'ban' ? 0xFF0000 : 0x00FF00)
            .setTitle(type === 'cargo' ? '⚙️ Mudança de Cargo' : '🛡️ Segurança')
            .addFields(
                { name: `${E.id} Usuário`, value: `${member.user.tag}`, inline: true },
                { name: '📝 Detalhes', value: content.substring(0, 1024) }
            ).setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    }
}

client.on('ready', async () => {
    const commands = [
        { name: 'servidores', description: 'Painel DEV' },
        { name: 'setlog', description: 'Configurar Logs', options: [
            { name: 'tipo', type: 3, required: true, choices: [{name:'Mensagens', value:'msg'}, {name:'Bans', value:'ban'}, {name:'Cargos', value:'cargo'}], description: 'Tipo' },
            { name: 'canal', type: 7, required: true, description: 'Canal' }
        ]},
        { name: 'addpalavra', description: 'Adicionar', options: [{ name: 'palavra', type: 3, required: true, description: 'Palavra' }] },
        { name: 'sair', description: 'Sair de servidor', options: [{ name: 'id', type: 3, required: true, description: 'ID' }] }
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: commands });
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply({ ephemeral: true });
    if (i.commandName === 'setlog') {
        db.logs[i.options.getString('tipo')] = i.options.getChannel('canal').id;
        save();
        i.editReply({ content: '✅ Log configurado.' });
    } else if (i.commandName === 'servidores') {
        if (i.user.id !== DEV_ID) return i.editReply({ content: '❌' });
        let r = `Servidores: ${client.guilds.cache.size}\n\n`;
        client.guilds.cache.forEach(g => r += `**${g.name}** (ID: ${g.id})\n`);
        i.editReply({ content: r });
    } else if (i.commandName === 'addpalavra') {
        db.palavras.push(i.options.getString('palavra'));
        save();
        i.editReply({ content: '✅' });
    } else if (i.commandName === 'sair') {
        const g = client.guilds.cache.get(i.options.getString('id'));
        if (g) await g.leave();
        i.editReply({ content: '🚪' });
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Log de Cargo
    if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
        const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
        const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
        if (added.size > 0 || removed.size > 0) {
            sendLog(newMember.guild, newMember, 'cargo', `+ ${added.map(r => r.name).join(', ') || 'Nenhum'} | - ${removed.map(r => r.name).join(', ') || 'Nenhum'}`);
        }
    }
    // Anti-Nick Burlado
    if (oldMember.displayName !== newMember.displayName && isMalicious(newMember.displayName)) {
        await newMember.ban({ reason: 'Nick Malicioso' }).catch(() => {});
        crossBan(newMember.id, 'Nick Malicioso');
    }
});

client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.guild) return;
    if (isMalicious(msg.content)) {
        await msg.delete().catch(() => {});
        sendLog(msg.guild, msg.member, 'msg', 'Mensagem bloqueada: ' + msg.content);
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.member && isMalicious(newState.member.displayName)) {
        await newState.member.ban({ reason: 'Nick na Call' }).catch(() => {});
        crossBan(newState.member.id, 'Nick na Call');
    }
});

client.login(TOKEN);

