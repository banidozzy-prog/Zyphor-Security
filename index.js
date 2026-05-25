const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const unidecode = require('unidecode');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';
const dbFile = './db.json';

// Banco de dados: servidores (local) e global (dev)
let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { servidores: {}, global: { logs: {} } };
function save() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

// --- MOTOR DE DETECÇÃO INTELIGENTE (O "SISTEMA AUTOMÁTICO") ---
function isMalicious(text) {
    const limpo = unidecode(text).toLowerCase();
    const isUnicodeBurlado = /[^\x20-\x7E]/.test(text); // Pega caracteres invisíveis/russos/gregos
    const blacklist = ['org', 'lideranca', 'apgratis', 'gratis', 'vagas', 'recrutamento', 'link na bio', 'fake nitro', 'phishing'];
    return blacklist.some(t => limpo.includes(t)) || isUnicodeBurlado;
}

// --- LOG GLOBAL (O QUE O DEV VÊ) ---
async function sendGlobalLog(type, member, data = {}) {
    const embed = new EmbedBuilder()
        .setTitle(`🌍 LOG GLOBAL: ${type.toUpperCase()}`)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: 'Usuário', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
            { name: 'Servidor', value: `${member.guild.name} (\`${member.guild.id}\`)`, inline: true },
            { name: 'Horário', value: new Date().toLocaleString('pt-BR') }
        )
        .setColor('#5865F2');
    
    // Envia para o canal definido em db.global.logs
    const canal = client.channels.cache.get(db.global.logs[type]);
    if (canal) canal.send({ embeds: [embed] });
}

// --- EVENTOS DE AUTO-BAN (A MÁQUINA DE SEGURANÇA) ---
client.on('guildMemberAdd', async (m) => {
    if (isMalicious(m.user.username) || isMalicious(m.displayName)) {
        await m.ban({ reason: 'Zyphor V3: Auto-Ban Inteligente' }).catch(() => {});
        sendGlobalLog('ban', m);
    }
});

// --- PAINEL (COMANDOS SLASH) ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;

    // COMANDOS DE PAINEL (STAFF)
    if (i.commandName === 'painel') {
        if (!i.member.permissions.has('ManageGuild')) return i.reply('❌');
        // Lógica do painel de cargos e config local
        i.reply({ content: '⚙️ **Painel Local:** Configurando...', ephemeral: true });
    }

    // COMANDOS DE DEV (GLOBAL)
    if (i.commandName === 'globalban' && i.user.id === DEV_ID) {
        // Lógica de ban global
        i.reply({ content: '✅ Comando global executado.', ephemeral: true });
    }
});

client.on('ready', async () => {
    const commands = [
        new SlashCommandBuilder().setName('painel').setDescription('⚙️ Painel de controle local da staff'),
        new SlashCommandBuilder().setName('globalban').setDescription('👑 [DEV ONLY] Bane globalmente')
            .addStringOption(o => o.setName('id').setRequired(true))
            .addStringOption(o => o.setName('motivo').setRequired(true))
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Zyphor V3: Sistema Global e Local Ativo.');
});

client.login(TOKEN);
