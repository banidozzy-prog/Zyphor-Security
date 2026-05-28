const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const unidecode = require('unidecode');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';
const dbFile = './db.json';

// Emojis (Usando o formato de string para renderizar no Discord)
const E = {
    editar: '<:editar:1501473720680583228>', id: '<:id:1507816963811049572>', 
    proibido: '<:proibido:1508982666056171631>', criar: '<:criar:1507816968286375976>', 
    cancelar: '<:cancelar:1509027635714326669>', confirmar: '<:corfimar:1509027559701086258>', 
    msgs: '<:mgs:1503163398395920464>', link: '<:link:1503163783139557461>', 
    doc: '<:documento:1507816962062029002>', hora: '<a:horaa:1501992592034762804>'
};

let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { 
    palavras: [], logs: { msg: '', ban: '' }, stats: {} 
};

function save() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const client = new Client({ intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, 
    GatewayIntentBits.GuildVoiceStates
]});

function isMalicious(text) {
    const isBurlado = /[\x00-\x1F\x7F-\x9F]/.test(text) || /[\u0370-\u03FF]/.test(text) || /[\u1D00-\u1D7F]/.test(text);
    const limpo = unidecode(text).toLowerCase().replace(/[^a-z0-9]/g, '');
    const blacklistDefault = ['apgratis', 'linknabio', 'gratis', 'scam', 'vagas', 'lideranca', 'org', 'phishing', 'fakenitro'];
    const todasPalavras = [...blacklistDefault, ...db.palavras.map(p => p.replace(/[^a-z0-9]/g, ''))];
    return isBurlado || todasPalavras.some(p => limpo.includes(p));
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
    if (!db.stats[guild.id]) db.stats[guild.id] = { bans: 0, msgs: 0, nome: guild.name };
    db.stats[guild.id][type === 'ban' ? 'bans' : 'msgs']++;
    save();

    const channel = guild.channels.cache.get(db.logs[type]);
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor(type === 'ban' ? 0xFF0000 : 0xFF8C00)
            .setTitle(type === 'ban' ? `${E.proibido} BAN AUTOMÁTICO` : `${E.doc} SEGURANÇA`)
            .addFields(
                { name: `${E.id} Usuário`, value: `${member.user.tag}`, inline: true },
                { name: `${E.editar} Motivo`, value: content || 'N/A' }
            ).setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    }
}

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.channelId && newState.member && isMalicious(newState.member.displayName)) {
        await newState.member.ban({ reason: 'Zyphor V3: Nick Burlado' }).catch(() => {});
        crossBan(newState.member.id, 'Nick Malicioso na Call');
        sendLog(newState.guild, newState.member, 'ban', 'Banido ao entrar na Call');
    }
});

client.on('guildMemberAdd', async (m) => {
    if (isMalicious(m.displayName)) {
        await m.ban({ reason: 'Zyphor V3: Nick Burlado' }).catch(() => {});
        crossBan(m.id, 'Nick Malicioso no ingresso');
    }
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply({ ephemeral: true });

    try {
        if (i.commandName === 'servidores') {
            if (i.user.id !== DEV_ID) return i.editReply({ content: '❌ Acesso negado.' });
            let resposta = "";
            for (const [id, s] of Object.entries(db.stats)) {
                const guild = client.guilds.cache.get(id);
                let invite = "Sem convite";
                try {
                    const channel = guild.channels.cache.find(c => c.type === 0);
                    if (channel) invite = (await channel.createInvite({ maxAge: 0 })).url;
                } catch(e) {}
                resposta += `**${s.nome}**\n${E.proibido} Bans: ${s.bans} | ${E.msgs} Msgs: ${s.msgs}\n${E.link} ${invite}\n\n`;
            }
            await i.editReply({ embeds: [new EmbedBuilder().setTitle(`${E.hora} Painel DEV`).setDescription(resposta || 'Sem dados.')] });
        }
        else if (i.commandName === 'painel') {
            await i.editReply({ content: `${E.confirmar} **Zyphor V3** operando com segurança total.` });
        }
        // ... (demais comandos seguem a mesma lógica)
    } catch (e) { await i.editReply({ content: `${E.cancelar} Erro ao processar.` }); }
});

client.login(TOKEN);
