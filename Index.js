const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, InteractionResponseFlags } = require('discord.js');
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
    if (!text) return false;
    const textLower = text.toLowerCase();
    const blacklistDefault = ['apgratis', 'linknabio', 'gratis', 'scam', 'vagas', 'lideranca', 'org', 'phishing', 'fakenitro'];
    const todasProibidas = [...blacklistDefault, ...db.palavras];
    
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|\b\w+\.\w{2,}\/\S+)/i;
    const isBurlado = /[\x00-\x1F\x7F-\x9F]/.test(text) || /[\u0370-\u03FF]/.test(text);
    const encontrouPalavra = todasProibidas.some(p => textLower.includes(p.toLowerCase()));

    return isBurlado || urlRegex.test(text) || encontrouPalavra;
}

async function crossBan(userId, reason) {
    client.guilds.cache.forEach(async (guild) => {
        try {
            const member = await guild.members.fetch(userId);
            if (member && member.bannable) await member.ban({ reason: `Zyphor V3: ${reason}` });
        } catch (e) {}
    });
}

async function sendLog(guild, member, type, content) {
    const channel = guild.channels.cache.get(db.logs[type]);
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor(type === 'ban' ? 0xFF0000 : 0x00FF00)
            .setTitle(type === 'cargo' ? '⚙️ Mudança de Cargo' : (type === 'ban' ? '🚫 Usuário Banido' : '🛡️ Segurança'))
            .addFields(
                { name: `${E.id} Usuário`, value: `${member.user.tag}`, inline: true },
                { name: '📝 Detalhes', value: content.substring(0, 1024) }
            ).setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    }
}

client.once('clientReady', async (c) => {
    const commands = [
        { name: 'servidores', description: 'Painel DEV' },
        { name: 'setlog', description: 'Configurar Logs', options: [{ name: 'tipo', type: 3, required: true, choices: [{name:'Mensagens', value:'msg'}, {name:'Bans', value:'ban'}, {name:'Cargos', value:'cargo'}], description: 'Tipo' }, { name: 'canal', type: 7, required: true, description: 'Canal' }] },
        { name: 'addpalavra', description: 'Adicionar', options: [{ name: 'palavra', type: 3, required: true, description: 'Ex: fdp,pnc' }] },
        { name: 'remover', description: 'Remover', options: [{ name: 'palavra', type: 3, required: true, description: 'Palavra' }] },
        { name: 'verpalavras', description: 'Lista' }
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(c.user.id), { body: commands });
    console.log(`✅ ZYPHOR V3 ATIVO EM: ${c.user.tag}`);
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply({ flags: [InteractionResponseFlags.Ephemeral] });
    
    try {
        if (i.commandName === 'setlog') {
            db.logs[i.options.getString('tipo')] = i.options.getChannel('canal').id;
            save();
            i.editReply({ content: '✅ Log configurado.' });
        } else if (i.commandName === 'addpalavra') {
            const novas = i.options.getString('palavra').split(',').map(p => p.trim().toLowerCase()).filter(p => p.length > 0);
            novas.forEach(p => { if (!db.palavras.includes(p)) db.palavras.push(p); });
            save();
            i.editReply({ content: `✅ Adicionadas: ${novas.join(', ')}` });
        } else if (i.commandName === 'remover') {
            const p = i.options.getString('palavra').toLowerCase();
            db.palavras = db.palavras.filter(w => w !== p);
            save();
            i.editReply({ content: `✅ Removida: ${p}` });
        } else if (i.commandName === 'verpalavras') {
            i.editReply({ content: `📜 **Lista:** ${db.palavras.join(', ') || 'Vazia'}` });
        } else if (i.commandName === 'servidores') {
            if (i.user.id !== DEV_ID) return;
            let r = `Servidores: ${client.guilds.cache.size}\n\n`;
            client.guilds.cache.forEach(g => r += `**${g.name}**\n`);
            i.editReply({ content: r });
        }
    } catch (e) { i.editReply({ content: '❌ Erro.' }); }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
        const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
        sendLog(newMember.guild, newMember, 'cargo', `+ ${added.map(r => r.name).join(', ') || 'Remoção'}`);
    }
    if (oldMember.displayName !== newMember.displayName && isMalicious(newMember.displayName)) {
        await newMember.ban({ reason: 'Nick Malicioso' }).catch(() => {});
        crossBan(newMember.id, 'Nick Malicioso');
    }
});

client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.guild) return;
    if (isMalicious(msg.content)) {
        await msg.delete().catch(() => {});
        sendLog(msg.guild, msg.member, 'msg', 'Mensagem bloqueada.');
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.member && isMalicious(newState.member.displayName)) {
        await newState.member.ban({ reason: 'Nick Malicioso' }).catch(() => {});
        crossBan(newState.member.id, 'Nick Malicioso');
    }
});

client.login(TOKEN);
