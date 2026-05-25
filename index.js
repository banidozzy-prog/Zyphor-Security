const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const unidecode = require('unidecode');

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';
const dbFile = './db.json';
let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { servidores: {}, global: { ban: null } };

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] 
});

// --- LÓGICA DE DETECÇÃO (Anti-Scam/Unicode) ---
const blacklist = ['org', 'lideranca', 'apgratis', 'gratis', 'vagas', 'recrutamento', 'link na bio'];

function isMalicious(user, displayName) {
    const nomeLimpo = unidecode(displayName || user.username).toLowerCase();
    // Pega letras gregas, unicode invisível e termos da blacklist
    const isUnicodeBurlado = /[^\x20-\x7E]/.test(user.username);
    return blacklist.some(t => nomeLimpo.includes(t)) || isUnicodeBurlado;
}

// --- BAN AUTOMÁTICO E LOG GLOBAL ---
async function executarBanGlobal(member, motivo) {
    console.log(`[BAN GLOBAL] ${member.user.tag}`);
    // Tenta banir em todos os servidores onde o bot está
    for (const guild of client.guilds.cache.values()) {
        await guild.members.ban(member.id, { reason: `Zyphor V3: ${motivo}` }).catch(() => {});
    }
}

// Evento: Monitorar entrada e troca de nick
client.on('guildMemberAdd', (m) => { if (isMalicious(m.user, m.displayName)) executarBanGlobal(m, 'Nick Malicioso'); });
client.on('guildMemberUpdate', (o, n) => { if (isMalicious(n.user, n.displayName)) executarBanGlobal(n, 'Troca de Nick Malicioso'); });
client.on('voiceStateUpdate', (o, n) => { if (n.channelId && isMalicious(n.member.user, n.member.displayName)) executarBanGlobal(n.member, 'Nick em Call'); });

// --- REGISTRO DE COMANDOS (Corrigido para evitar o erro do log) ---
client.on('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    const commands = [
        new SlashCommandBuilder().setName('configurar').setDescription('⚙️ Abre painel da staff'),
        new SlashCommandBuilder().setName('globalban').setDescription('👑 [DEV] Bane usuário globalmente')
            .addStringOption(o => o.setName('id').setDescription('ID do alvo').setRequired(true))
            .addStringOption(o => o.setName('motivo').setDescription('Motivo').setRequired(true))
    ];

    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Comandos registrados sem erros!');
    } catch (e) { console.error('Erro ao registrar:', e); }
});

client.login(TOKEN);
