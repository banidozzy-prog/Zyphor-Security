const { Client, GatewayIntentBits } = require('discord.js');

// Puxa o token direto das Variables da Railway
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

// Lista negra antiga (letras minúsculas e sem espaços)
const assinaturasGolpe = ['org', 'lideranca', 'apgratis', 'gratis', 'vagas', 'recrutamento'];

function checarSeEhInvasor(texto) {
    if (!texto) return false;
    const textoLimpo = texto.toLowerCase();
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

// Monitoramentos automáticos do sistema antigo
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;
    if (checarSeEhInvasor(member.user.username) || checarSeEhInvasor(member.displayName)) {
        await aplicarBanimentoGlobal(member.id, 'Nome proibido na entrada.');
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!oldState.channelId && newState.channelId) {
        const member = newState.member;
        if (!member || member.user.bot) return;

        const dadosCall = `${member.user.username} ${member.displayName} ${member.nickname || ''}`;
        if (checarSeEhInvasor(dadosCall)) {
            await aplicarBanimentoGlobal(member.id, 'Filtro de Voz.');
        }
    }
});

// Mensagem de Inicialização com os seus emojis ajustados
client.on('ready', () => {
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);
    console.log(`[ONLINE] <:bot:1503164137906372608> Zyphor Security V3 carregado com sucesso!`);
    console.log(`[STATUS] <:monitoramento:1503163485264285776> Proteção ativa no sistema antigo.`);
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);
});

if (TOKEN) {
    client.login(TOKEN);
} else {
    console.log("[AVISO] DISCORD_TOKEN não configurado nas variáveis.");
}

