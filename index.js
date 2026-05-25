const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const unidecode = require('unidecode');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';
const dbFile = './db.json';

let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { servidores: {}, global: { ban: null, msg: null } };
function save() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

// --- SEGURANÇA E AUTO-BAN ---
const blacklist = ['org', 'lideranca', 'apgratis', 'gratis', 'vagas', 'recrutamento'];
function isMalicious(user, displayName) {
    const nomeLimpo = unidecode(displayName || user.username).toLowerCase();
    const isUnicodeBurlado = /[^\x20-\x7E]/.test(user.username);
    return blacklist.some(t => nomeLimpo.includes(t)) || isUnicodeBurlado;
}

async function banirEGlobalLog(member, motivo) {
    await member.ban({ reason: `Zyphor V3: ${motivo}` }).catch(() => {});
    const embed = new EmbedBuilder()
        .setTitle('🔨 Ban Global Detectado')
        .setColor('#FF0000')
        .addFields(
            { name: 'Usuário', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
            { name: 'Motivo', value: motivo, inline: true },
            { name: 'Servidor', value: member.guild.name, inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();
    
    if (db.global.ban) client.channels.cache.get(db.global.ban)?.send({ embeds: [embed] });
}

// Eventos de Monitoramento
client.on('guildMemberAdd', (m) => { if (isMalicious(m.user, m.displayName)) banirEGlobalLog(m, 'Nick Scam/Malicioso'); });
client.on('guildMemberUpdate', (o, n) => { if (isMalicious(n.user, n.displayName)) banirEGlobalLog(n, 'Troca de Nick Malicioso'); });

// --- PAINEL STAFF (LOCAL) E DEV (GLOBAL) ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;

    // COMANDOS DEV
    if (i.commandName === 'globalban' && i.user.id === DEV_ID) {
        const id = i.options.getString('id');
        const motivo = i.options.getString('motivo');
        // Lógica de banir globalmente e enviar no canal de log global
        i.reply({ content: `✅ Ban global aplicado em ${id}`, ephemeral: true });
    }

    // COMANDOS STAFF (LOCAL)
    if (i.commandName === 'configurar') {
        if (!i.member.permissions.has('Administrator')) return i.reply('❌');
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu-config').addOptions([
                { label: 'Configurar Logs de Entrada', value: 'logEntrada' },
                { label: 'Configurar Logs de Bans', value: 'logBan' },
                { label: 'Resetar Configurações', value: 'reset' }
            ])
        );
        i.reply({ content: '⚙️ **Painel Zyphor Security:**', components: [menu], ephemeral: true });
    }
});

// --- REGISTRO DE COMANDOS ---
client.on('ready', async () => {
    const cmds = [
        new SlashCommandBuilder().setName('configurar').setDescription('Configura o servidor'),
        new SlashCommandBuilder().setName('globalban').setDescription('DEV ONLY')
            .addStringOption(o => o.setName('id').setRequired(true))
            .addStringOption(o => o.setName('motivo').setRequired(true))
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: cmds });
    console.log('✅ Zyphor V3 Proteção Global Ativa.');
});

client.login(TOKEN);

