const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const FILE_PATH = './config-zyphor.json';

// Inicializa ou carrega as configurações salvas
let db = {
    status_entrada: true,
    status_voz: true,
    canal_entrada: 'Não definido',
    canal_saida: 'Não definido',
    canal_mensagens: 'Não definido',
    canal_voz: 'Não definido',
    canal_punicoes: 'Não definido'
};

if (fs.existsSync(FILE_PATH)) {
    try { db = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8')); } catch(e) {}
}

function salvarDados() {
    fs.writeFileSync(FILE_PATH, JSON.stringify(db, null, 2));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

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

// 🛡️ SISTEMA DE PROTEÇÃO COM INTERRUPTOR (LIGA/DESLIGA)
client.on('guildMemberAdd', async (member) => {
    if (!db.status_entrada) return; // Se tiver desativado no painel, não faz nada
    if (member.user.bot) return;
    if (checarSeEhInvasor(member.user.username) || checarSeEhInvasor(member.displayName)) {
        await aplicarBanimentoGlobal(member.id, 'Nome proibido na entrada do servidor.');
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!db.status_voz) return; // Se tiver desativado no painel, não faz nada
    if (!oldState.channelId && newState.channelId) {
        const member = newState.member;
        if (!member || member.user.bot) return;

        const dadosCall = `${member.user.username} ${member.displayName} ${member.nickname || ''}`;
        if (checarSeEhInvasor(dadosCall)) {
            await aplicarBanimentoGlobal(member.id, 'Filtro automático de Call de Voz.');
        }
    }
});

// 🛠️ PROCESSAMENTO DOS COMANDOS
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'configurar') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: `<:erro:1508472500495974600> Apenas administradores podem usar este comando.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('Zyphor BOTS ⚙️')
            .setDescription(
                `🛠 *Informações sobre o sistema:*\n` +
                `<:status:1503163485264285776> **Status Geral:** Ativado\n\n` +
                `**⚙️ Painel de Proteção:**\n` +
                `${db.status_entrada ? '🟢' : '🔴'} Anti-Raid de Entrada: **${db.status_entrada ? 'ATIVADO' : 'DESATIVADO'}**\n` +
                `${db.status_voz ? '🟢' : '🔴'} Filtro de Voz (Call): **${db.status_voz ? 'ATIVADO' : 'DESATIVADO'}**\n\n` +
                `**Canais definidos:**\n` +
                `<:documento:1507816962062029002> **Entrada:** ${db.canal_entrada}\n` +
                `<:documento:1507816962062029002> **Saída:** ${db.canal_saida}\n` +
                `<:mgs:1503163398395920464> **Mensagem:** ${db.canal_mensagens}\n` +
                `<:monitoramento:1503163485264285776> **Voz:** ${db.canal_voz}\n` +
                `<:martelo:1503163618273792050> **Bans:** ${db.canal_punicoes}\n\n` +
                `🍃 Em caso de **dúvidas** ou **bugs**, não hesite em entrar em meu **[servidor de suporte](https://discord.gg/Guw9zJE9nP)** para que nossa equipe possa lhe ajudar.`
            )
            .setColor('#5865F2')
            .setFooter({ text: 'Zyphor BOTS | Painel de Controle Avançado' });

        // Botões para Ativar / Desativar a proteção direto no chat
        const botoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('toggle_entrada')
                .setLabel('Alternar Anti-Raid Entrada')
                .setStyle(db.status_entrada ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('toggle_voz')
                .setLabel('Alternar Filtro de Voz')
                .setStyle(db.status_voz ? ButtonStyle.Success : ButtonStyle.Danger)
        );

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('menu-config')
                .setPlaceholder('Selecione para definir os canais do Bot.')
                .addOptions([
                    { label: 'Definar canal de Entrada', value: 'set_entrada' },
                    { label: 'Definar canal de Saída', value: 'set_saida' },
                    { label: 'Definar canal de Punições', value: 'set_bans' }
                ])
        );

        return interaction.reply({ embeds: [embed], components: [botoes, menu] });
    }

    if (commandName === 'ping') {
        const latência = Math.round(client.ws.ping);
        return interaction.reply({ content: `<:sino:1507817911392407552> **Pong!** Minha latência atual é de \`${latência}ms\`.` });
    }

    if (commandName === 'dev') {
        return interaction.reply({ content: `<:bot:1503164137906372608> **Zyphor Security v3**\n<:ID:1507816963811049572> Desenvolvido por: <@743229615024242709> (\`banidozzy\`)` });
    }

    if (commandName === 'clear') {
        if (!interaction.member.permissions.has('ManageMessages')) {
            return interaction.reply({ content: `<:erro:1508472500495974600> Você não tem permissão para usar este comando.`, ephemeral: true });
        }
        const quantidade = interaction.options.getInteger('quantidade');
        await interaction.deferReply({ ephemeral: true });
        try {
            const mensagensDeletadas = await interaction.channel.bulkDelete(quantidade, true);
            return interaction.editReply({ content: `<:martelo:1503163618273792050> Limpeza concluída! Deletadas **${mensagensDeletadas.size}** mensagens.` });
        } catch (err) {
            return interaction.editReply({ content: `<:erro:1508472500495974600> Erro ao limpar as mensagens.` });
        }
    }
});

// 📱 CLIQUE DOS BOTÕES (LIGA / DESLIGA) E SELEÇÃO DE MENUS
client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: 'Você não tem permissão.', ephemeral: true });
        }

        if (interaction.customId === 'toggle_entrada') {
            db.status_entrada = !db.status_entrada;
            salvarDados();
            return interaction.reply({ content: `🛠️ Anti-Raid de Entrada mudou para: **${db.status_entrada ? 'ATIVADO 🟢' : 'DESATIVADO 🔴'}**`, ephemeral: true });
        }

        if (interaction.customId === 'toggle_voz') {
            db.status_voz = !db.status_voz;
            salvarDados();
            return interaction.reply({ content: `🛠️ Filtro de Call de Voz mudou para: **${db.status_voz ? 'ATIVADO 🟢' : 'DESATIVADO 🔴'}**`, ephemeral: true });
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'menu-config') {
            const salaAtual = interaction.channel.toString();
            const escolha = interaction.values[0];

            if (escolha === 'set_entrada') db.canal_entrada = salaAtual;
            if (escolha === 'set_saida') db.canal_saida = salaAtual;
            if (escolha === 'set_bans') db.canal_punicoes = salaAtual;

            salvarDados();
            return interaction.reply({ content: `✅ Este canal foi configurado no sistema! Use \`/configurar\` novamente para atualizar a lista.`, ephemeral: true });
        }
    }
});

client.on('ready', async () => {
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);
    console.log(`[ONLINE] Zyphor Painel V3 carregado com sucesso!`);
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);

    const comandos = [
        new SlashCommandBuilder().setName('configurar').setDescription('⚙️ Painel de Controle Interativo Liga/Desliga.'),
        new SlashCommandBuilder().setName('ping').setDescription('🏓 Verifica a latência do bot.'),
        new SlashCommandBuilder().setName('dev').setDescription('👑 Mostra as informações do criador.'),
        new SlashCommandBuilder().setName('clear').setDescription('🧹 Limpa as mensagens do canal.').addIntegerOption(o => o.setName('quantidade').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100))
    ].map(cmd => cmd.toJSON());

    try {
        await new REST({ version: '10' }).setToken(TOKEN).put(
            Routes.applicationCommands(client.user.id),
            { body: comandos }
        );
    } catch (e) {}
});

if (TOKEN) client.login(TOKEN);

