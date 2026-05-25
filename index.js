// 📦 SISTEMA AUTO-INSTALÁVEL
try {
    require('unidecode');
} catch (e) {
    console.log('[SISTEMA] Instalando unidecode...');
    require('child_process').execSync('npm install unidecode');
}

const { Client, GatewayIntentBits } = require('discord.js');
const unidecode = require('unidecode');

// 📌 Puxa a variável de ambiente de forma segura
const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 📌 LISTA NEGRA DE TERMOS
const assinaturasGolpe = ['org', 'lideranca', 'apgratis', 'gratis', 'vagas', 'recrutamento'];

function checarSeEhInvasor(texto) {
    if (!texto) return false;
    const textoLimpo = unidecode(texto).toLowerCase().replace(/\s+/g, '');
    return assinaturasGolpe.some(termo => textoLimpo.includes(termo));
}

async function aplicarBanimentoGlobal(userId, motivo) {
    console.log(`[ALERTA GLOBAL] Banindo ID: ${userId}`);
    for (const guild of client.guilds.cache.values()) {
        try { 
            await guild.members.ban(userId, { reason: `Zyphor Security: ${motivo}` }); 
        } catch (error) {
            continue;
        }
    }
}

// Gatilho 1: Entrada no Servidor
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;
    if (checarSeEhInvasor(`${member.user.username} ${member.displayName}`)) {
        await aplicarBanimentoGlobal(member.id, 'Conta identificada com nome proibido na entrada.');
    }
});

// Gatilho 2: Conexão em Call de Voz
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!oldState.channelId && newState.channelId) {
        const member = newState.member;
        if (!member || member.user.bot) return;

        if (checarSeEhInvasor(`${member.user.username} ${member.displayName} ${member.nickname || ''}`)) {
            await aplicarBanimentoGlobal(member.id, 'Tentativa de raid / Divulgação em canal de voz.');
        }
    }
});

// Gatilho 3: Mudança de Apelido Local
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (newMember.user.bot) return;
    if (oldMember.nickname !== newMember.nickname && newMember.nickname) {
        if (checarSeEhInvasor(newMember.nickname)) {
            await aplicarBanimentoGlobal(newMember.id, 'Alteração de apelido local para assinatura de golpe.');
        }
    }
});

// Gatilho 4: Mudança de Conta Global
client.on('userUpdate', async (oldUser, newUser) => {
    if (newUser.bot) return;
    if (oldUser.username !== newUser.username || oldUser.displayName !== newUser.displayName) {
        if (checarSeEhInvasor(`${newUser.username} ${newUser.displayName}`)) {
            await aplicarBanimentoGlobal(newUser.id, 'Alteração de perfil global para assinatura de ataque.');
        }
    }
});

// -------------------------------------------------------------------------
// LIGAR O BOT
// -------------------------------------------------------------------------
client.on('ready', () => {
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);
    console.log(`[ONLINE] <:bot:1503164137906372608> Zyphor Security V3 carregado com sucesso!`);
    console.log(`[STATUS] <:monitoramento:1503163485264285776> Proteção ativa contra invasores.`);
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);
});

if (TOKEN) {
    client.login(TOKEN);
} else {
    console.log("[AVISO] Aguardando o token para iniciar...");
}

