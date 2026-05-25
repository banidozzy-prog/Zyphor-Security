const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const unidecode = require('unidecode');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] 
});

// --- MOTOR DE DETECÇÃO (Anti-Scam/Unicode) ---
// Adicione aqui todos os termos que aparecem nas suas fotos
const blacklist = ['ap gratis', 'link na bio', 'lideranca', 'org', 'vagas', 'recrutamento'];

function isMalicious(user, displayName) {
    const nomeLimpo = unidecode(displayName || user.username).toLowerCase();
    // Detecta caracteres invisíveis, gregos e os termos da blacklist
    const hasUnicode = /[^\x20-\x7E]/.test(user.username);
    return blacklist.some(t => nomeLimpo.includes(t)) || hasUnicode;
}

// --- FUNÇÃO DE BAN GLOBAL ---
async function banirGlobal(member, motivo) {
    console.log(`[BAN GLOBAL] ${member.user.tag} - ${motivo}`);
    // Itera por todos os servidores do bot
    for (const guild of client.guilds.cache.values()) {
        await guild.members.ban(member.id, { reason: `Zyphor Security: ${motivo}` }).catch(() => {});
    }
}

// Eventos de Monitoramento
client.on('guildMemberAdd', (m) => { if (isMalicious(m.user, m.displayName)) banirGlobal(m, 'Nick Malicioso Detectado'); });
client.on('guildMemberUpdate', (o, n) => { if (isMalicious(n.user, n.displayName)) banirGlobal(n, 'Troca de Nick Maliciosa'); });
client.on('voiceStateUpdate', (o, n) => { if (n.channelId && isMalicious(n.member.user, n.member.displayName)) banirGlobal(n.member, 'Nick em Call Detectado'); });

// --- REGISTRO DE COMANDOS (GARANTINDO QUE NADA SEJA UNDEFINED) ---
client.on('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    
    // Lista de comandos com todas as strings preenchidas (evita o erro do seu log)
    const commands = [
        new SlashCommandBuilder().setName('painel').setDescription('Abre o painel de configuracao local'),
        new SlashCommandBuilder().setName('globalban').setDescription('Bane usuario globalmente')
            .addStringOption(o => o.setName('id').setDescription('ID do alvo').setRequired(true))
            .addStringOption(o => o.setName('motivo').setDescription('Motivo do ban').setRequired(true))
    ];

    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Comandos registrados com sucesso!');
    } catch (e) { console.error('Erro de registro:', e); }
});

// --- INTERAÇÕES ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    
    // Trava de segurança para comandos GLOBAIS
    if (i.commandName === 'globalban' && i.user.id !== DEV_ID) {
        return i.reply({ content: '❌ Acesso restrito ao DEV MASTER.', ephemeral: true });
    }
    
    // Logica aqui...
});

client.login(TOKEN);
