const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const unidecode = require('unidecode');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';
const dbFile = './db.json';

const E = {
    proibido: '<:proibido:1508982666056171631>', 
    confirmar: '<:corfimar:1509027559701086258>', 
    cancelar: '<:cancelar:1509027635714326669>', 
    msgs: '<:mgs:1503163398395920464>', 
    hora: '<a:horaa:1501992592034762804>'
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
    if (!db.stats[guild.id]) db.stats[guild.id] = { bans: 0, msgs: 0, nome: guild.name };
    db.stats[guild.id][type === 'ban' ? 'bans' : 'msgs']++;
    save();

    const channel = guild.channels.cache.get(db.logs[type]);
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor(type === 'ban' ? 0xFF0000 : 0xFF8C00)
            .setTitle(type === 'ban' ? '🚨 BAN AUTOMÁTICO' : '🚫 SEGURANÇA')
            .setDescription(`**Usuário:** ${member.user.tag}\n**Motivo:** ${content}`)
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    }
}

client.on('ready', async () => {
    const commands = [
        { name: 'painel', description: '⚙️ Painel da Staff' },
        { name: 'addpalavra', description: '➕ Adicionar', options: [{ name: 'palavra', type: 3, required: true, description: 'Ex: fdp,macaco' }] },
        { name: 'remover', description: '➖ Remover', options: [{ name: 'palavra', type: 3, required: true, description: 'Palavra' }] },
        { name: 'verpalavras', description: '📜 Lista' },
        { name: 'servidores', description: '👑 Painel DEV' },
        { name: 'sair', description: '🚪 Sai de um servidor', options: [{ name: 'id', type: 3, required: true, description: 'ID do servidor' }] },
        { name: 'setlog', description: '📑 Logs', options: [
            { name: 'tipo', type: 3, required: true, choices: [{name:'Mensagens', value:'msg'}, {name:'Bans', value:'ban'}], description: 'Tipo' },
            { name: 'canal', type: 7, required: true, description: 'Canal' }
        ]}
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ ZYPHOR V3 ATIVO');
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply({ ephemeral: true });

    try {
        if (i.commandName === 'servidores') {
            if (i.user.id !== DEV_ID) return i.editReply({ content: '❌ Acesso negado.' });
            let r = "📊 **Stats dos Servidores:**\n\n";
            for (const [id, s] of Object.entries(db.stats)) {
                r += `**${s.nome}** (ID: ${id})\n${E.proibido} Bans: ${s.bans} | ${E.msgs} Msgs: ${s.msgs}\n\n`;
            }
            await i.editReply({ embeds: [new EmbedBuilder().setTitle(`${E.hora} Painel DEV`).setDescription(r || 'Sem dados.')] });
        }
        else if (i.commandName === 'sair') {
            if (i.user.id !== DEV_ID) return i.editReply({ content: '❌ Acesso negado.' });
            const g = client.guilds.cache.get(i.options.getString('id'));
            if (!g) return i.editReply({ content: '❌ Servidor não encontrado.' });
            await g.leave();
            await i.editReply({ content: `🚪 Saí do servidor: ${g.name}` });
        }
        else if (i.commandName === 'addpalavra') {
            i.options.getString('palavra').split(',').forEach(p => { if (!db.palavras.includes(p.trim().toLowerCase())) db.palavras.push(p.trim().toLowerCase()); });
            save();
            await i.editReply({ content: `${E.confirmar} Palavras adicionadas.` });
        }
        else if (i.commandName === 'remover') {
            const p = i.options.getString('palavra').toLowerCase();
            db.palavras = db.palavras.filter(w => w !== p);
            save();
            await i.editReply({ content: `${E.confirmar} Removido.` });
        }
        else if (i.commandName === 'verpalavras') {
            await i.editReply({ content: `📜 **Lista:** ${db.palavras.join(', ') || 'Vazia'}` });
        }
        else if (i.commandName === 'painel') {
            await i.editReply({ content: `${E.confirmar} Zyphor V3 operando.` });
        }
        else if (i.commandName === 'setlog') {
            db.logs[i.options.getString('tipo')] = i.options.getChannel('canal').id;
            save();
            await i.editReply({ content: '✅ Log setado.' });
        }
    } catch (e) { await i.editReply({ content: `${E.cancelar} Erro.` }); }
});

client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.guild) return;
    if (isMalicious(msg.content)) {
        await msg.delete().catch(() => {});
        sendLog(msg.guild, msg.member, 'msg', 'Conteúdo malicioso/Link');
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.channelId && newState.member && isMalicious(newState.member.displayName)) {
        await newState.member.ban({ reason: 'Zyphor V3: Nick Burlado' }).catch(() => {});
        crossBan(newState.member.id, 'Nick Malicioso em Call');
        sendLog(newState.guild, newState.member, 'ban', 'Banido ao entrar na Call');
    }
});

client.login(TOKEN);
