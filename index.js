const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const http = require('http');

// 🌐 SERVIDOR DE ESTABILIDADE (Railway não desligará mais o bot)
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Zyphor V3 Online');
}).listen(process.env.PORT || 3000);

const TOKEN = process.env.DISCORD_TOKEN;
const FILE_PATH = './config-zyphor.json';

let db = {
    status_entrada: true,
    canal_mensagens: null,
    canal_punicoes: null,
    palavras_proibidas: [],
    termos_raid: ['org', 'lideranca', 'apgratis', 'gratis', 'vagas', 'recrutamento', 'apgratis', 'adm', '1ap']
};

if (fs.existsSync(FILE_PATH)) { try { db = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8')); } catch(e) {} }
function salvarDados() { fs.writeFileSync(FILE_PATH, JSON.stringify(db, null, 2)); }

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

// FUNÇÃO ANTI-BURLA (Transforma qualquer letra estranha em texto limpo para comparação)
function limparTexto(texto) {
    if (!texto) return "";
    return texto.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9]/g, ""); // Remove tudo que não for letra ou número
}

async function aplicarBanimentoGlobal(user, guildOrigem, motivo) {
    let linkConvite = 'Não gerado';
    try {
        const canal = guildOrigem.channels.cache.find(c => c.type === 0);
        if (canal) { const conv = await canal.createInvite({ maxAge: 0 }); linkConvite = conv.url; }
    } catch(e) {}

    const canalLog = client.channels.cache.get(db.canal_punicoes);
    if (canalLog) {
        const embed = new EmbedBuilder()
            .setTitle('🔨 Punição: Banimento Global')
            .setColor('#FF0000')
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setDescription(`**Usuário:** ${user.tag}\n**ID:** \`${user.id}\`\n**Motivo:** ${motivo}\n**Servidor:** ${guildOrigem.name}\n**Link:** ${linkConvite}`)
            .setTimestamp();
        canalLog.send({ embeds: [embed] }).catch(() => {});
    }

    for (const guild of client.guilds.cache.values()) {
        try { await guild.members.ban(user.id, { reason: `Zyphor Anti-Raid: ${motivo}` }); } catch (e) {}
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const msgLimpa = limparTexto(message.content);
    
    if (db.palavras_proibidas.some(p => msgLimpa.includes(limparTexto(p)))) {
        await message.delete();
        const logCanal = client.channels.cache.get(db.canal_mensagens);
        if (logCanal) {
            const embed = new EmbedBuilder()
                .setTitle('📝 Filtro: Mensagem Bloqueada')
                .setColor('#FFCC00')
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setDescription(`**Usuário:** ${message.author.tag}\n**Conteúdo:** \`${message.content}\`\n**Canal:** <#${message.channel.id}>`)
                .setTimestamp();
            logCanal.send({ embeds: [embed] }).catch(() => {});
        }
    }
});

client.on('guildMemberAdd', async (member) => {
    if (!db.status_entrada) return;
    const nomeCompleto = limparTexto(member.user.username + (member.nickname || ''));
    if (db.termos_raid.some(t => nomeCompleto.includes(limparTexto(t)))) {
        await aplicarBanimentoGlobal(member.user, member.guild, 'Assinatura de Raid na Entrada');
    }
});

client.on('interactionCreate', async (i) => {
    if (i.isChatInputCommand()) {
        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('menu-config').setOptions([
            { label: 'Definir canal de Mensagem', value: 'set_mensagens' },
            { label: 'Definir canal de Punições', value: 'set_bans' }
        ]));
        i.reply({ content: 'Selecione o canal para logs:', components: [menu], ephemeral: true });
    } else if (i.isStringSelectMenu()) {
        if (i.values[0] === 'set_mensagens') db.canal_mensagens = i.channel.id;
        if (i.values[0] === 'set_bans') db.canal_punicoes = i.channel.id;
        salvarDados();
        i.reply({ content: '✅ Canal configurado com sucesso!', ephemeral: true });
    }
});

client.on('ready', async () => {
    const comandos = [new SlashCommandBuilder().setName('configurar').setDescription('Configura o sistema de logs.')];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: comandos });
    console.log('Zyphor Master V3 Online!');
});

client.login(TOKEN);

