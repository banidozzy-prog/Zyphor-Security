const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';
const dbFile = './db.json';

// Banco de dados simples
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

// Funções utilitárias
const isMalicious = (text) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    const blacklist = ['apgratis', 'linknabio', 'gratis', 'scam', 'vagas', 'phishing', ...db.palavras];
    return blacklist.some(p => lower.includes(p.toLowerCase()));
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

// Registro de comandos Slash
client.once('clientReady', async (c) => {
    const commands = [
        { name: 'servidores', description: 'Painel de Gestão' },
        { name: 'setlog', description: 'Configurar logs', options: [
            { name: 'tipo', type: 3, required: true, choices: [{name:'Mensagens', value:'msg'}, {name:'Bans', value:'ban'}, {name:'Cargos', value:'cargo'}], description: 'Tipo' },
            { name: 'canal', type: 7, required: true, description: 'Canal' }
        ]},
        { name: 'addpalavra', description: 'Add palavra', options: [{ name: 'palavra', type: 3, required: true, description: 'Ex: fdp,pnc' }] },
        { name: 'verpalavras', description: 'Listar palavras' }
    ];

    try {
        await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(c.user.id), { body: commands });
        console.log(`✅ Zyphor V3 online como ${c.user.tag}`);
    } catch (e) { console.error('❌ Falha ao registrar:', e); }
});

// Interações Slash
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply({ flags: [64] });

    if (i.commandName === 'servidores' && i.user.id === DEV_ID) {
        let r = "🌐 **Painel de Gestão**\n\n";
        client.guilds.cache.forEach(g => {
            r += `**${g.name}**\n🆔 ID: \`!gr ${g.id}\` | \`!apg ${g.id}\`\n\n`;
        });
        i.editReply(r || 'Nenhum servidor.');
    } else if (i.commandName === 'setlog') {
        db.logs[i.options.getString('tipo')] = i.options.getChannel('canal').id;
        save();
        i.editReply('✅ Log atualizado.');
    } else if (i.commandName === 'addpalavra') {
        const w = i.options.getString('palavra').split(',').map(p => p.trim().toLowerCase());
        w.forEach(p => { if (!db.palavras.includes(p)) db.palavras.push(p); });
        save();
        i.editReply(`✅ Palavras salvas.`);
    } else if (i.commandName === 'verpalavras') {
        i.editReply(`📜 **Palavras:** ${db.palavras.join(', ') || 'Vazia'}`);
    }
});

// Comandos de chat (Prefix)
client.on('messageCreate', async (m) => {
    if (m.author.bot || !m.guild) return;
    
    // Filtro malicioso
    if (isMalicious(m.content)) { m.delete().catch(() => {}); sendLog(m.guild, m.member, 'msg', 'Mensagem bloqueada.'); }

    // Comandos de Dev
    if (m.author.id !== DEV_ID || !m.content.startsWith('!')) return;
    const [cmd, id] = m.content.split(' ');
    const guild = client.guilds.cache.get(id);

    if (cmd === '!gr' && guild) {
        const ch = guild.channels.cache.find(c => c.type === 0);
        const inv = await ch?.createInvite({ maxAge: 0, maxUses: 0 }).catch(() => null);
        m.reply(inv ? `🔗 ${inv.url}` : "❌ Sem permissão de convite.");
    } else if (cmd === '!apg' && guild) {
        await guild.leave();
        m.reply(`✅ Saiu de: ${guild.name}`);
    }
});

client.on('guildMemberUpdate', (oldM, newM) => {
    if (oldM.displayName !== newM.displayName && isMalicious(newM.displayName)) newM.ban({ reason: 'Nick malicioso' });
});

client.login(TOKEN);
