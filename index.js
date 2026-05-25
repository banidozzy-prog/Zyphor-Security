const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

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

// Lista negra antiga (sistema liso)
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

// 🛡️ SISTEMA DE PROTEÇÃO AUTOMÁTICA
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

// 🛠️ PROCESSAMENTO DOS COMANDOS SLASH
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // 1. Comando Configurar (Painel Principal)
    if (commandName === 'configurar') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: `<:erro:1508472500495974600> Apenas administradores podem usar este comando.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('Zyphor BOTS ⚙️')
            .setDescription(
                `🛠️ **Informações sobre o sistema:**\n` +
                `<:status:1503163485264285776> **Status:** Ativado\n\n` +
                `**Canais definidos:**\n` +
                `<:documento:1507816962062029002> **Entrada:** 📑 • #entrada\n` +
                `<:documento:1507816962062029002> **Saída:** 📑 • #saida\n` +
                `<:mgs:1503163398395920464> **Mensagem:** 📑 • #mensagens\n` +
                `<:monitoramento:1503163485264285776> **Voz:** 📑 • #voz\n` +
                `<:martelo:1503163618273792050> **Bans:** 📑 • #punições\n` +
                `<:ID:1507816963811049572> **Adicionar/Remover Cargos:** 📑 • #set-cargos\n` +
                `<:editar:1501473720680583228> **Criar/Deletar/Editar Cargos:** 📑 • #gerenciar-cargos\n` +
                `<:criar:1507816968286375976> **Criar/Deletar/Editar Canais:** 📑 • #gerenciar-canais\n\n` +
                `🍃 Em caso de **dúvidas** ou **bugs**, não hesite em entrar em meu **[servidor de suporte](https://discord.gg/)** para que nossa equipe possa lhe ajudar.`
            )
            .setColor('#5865F2')
            .setFooter({ text: 'Zyphor BOTS | Sistema de Configuração' });

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('menu-config')
                .setPlaceholder('Selecione a opção desejada para configurar.')
                .addOptions([
                    { label: 'Configurar Canais', description: 'Defina os canais de entrada, saída e logs.', value: 'conf_canais' },
                    { label: 'Configurar Cargos', description: 'Gerencie as permissões de cargos do bot.', value: 'conf_cargos' },
                    { label: 'Sistema Anti-Raid', description: 'Ajuste os filtros de proteção automática.', value: 'conf_raid' }
                ])
        );

        return interaction.reply({ embeds: [embed], components: [menu] });
    }

    // 2. Comando Ping
    if (commandName === 'ping') {
        const latência = Math.round(client.ws.ping);
        return interaction.reply({ content: `<:sino:1507817911392407552> **Pong!** Minha latência atual é de \`${latência}ms\`.` });
    }

    // 3. Comando Dev
    if (commandName === 'dev') {
        return interaction.reply({
            content: `<:bot:1503164137906372608> **Zyphor Security v3**\n<:ID:1507816963811049572> Desenvolvido por: <@743229615024242709> (\`banidozzy\`)`
        });
    }

    // 4. Comando Clear
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
            return interaction.editReply({ content: `<:erro:1508472500495974600> Erro ao tentar limpar as mensagens deste canal.` });
        }
    }
});

// 🛠️ ESCUTAR AS INTERAÇÕES DO MENU DE SELEÇÃO
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'menu-config') {
        const valorSelecionado = interaction.values[0];
        
        if (valorSelecionado === 'conf_canais') {
            return interaction.reply({ content: `<:editar:1501473720680583228> Menu de canais aberto! Use os comandos correspondentes para setar as salas.`, ephemeral: true });
        }
        if (valorSelecionado === 'conf_cargos') {
            return interaction.reply({ content: `<:ID:1507816963811049572> Configuração de cargos selecionada.`, ephemeral: true });
        }
        if (valorSelecionado === 'conf_raid') {
            return interaction.reply({ content: `<:monitoramento:1503163485264285776> Sistema de proteção ajustado para o modo automático padrão.`, ephemeral: true });
        }
    }
});

// 🚀 SINKRONIZAR E REGISTRAR TODOS OS COMANDOS
client.on('ready', async () => {
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);
    console.log(`[ONLINE] Zyphor Security V3 carregado com sucesso!`);
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);

    const comandos = [
        new SlashCommandBuilder()
            .setName('configurar')
            .setDescription('⚙️ Abre o menu de configuração do Zyphor BOTS.'),
        new SlashCommandBuilder()
            .setName('ping')
            .setDescription('🏓 Verifica a latência do bot.'),
        new SlashCommandBuilder()
            .setName('dev')
            .setDescription('👑 Mostra as informações do criador do bot.'),
        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('🧹 Limpa as mensagens do canal atual.')
            .addIntegerOption(opt => 
                opt.setName('quantidade')
                   .setDescription('Número de mensagens para apagar (1-100)')
                   .setRequired(true)
                   .setMinValue(1)
                   .setMaxValue(100)
            )
    ].map(cmd => cmd.toJSON());

    try {
        await new REST({ version: '10' }).setToken(TOKEN).put(
            Routes.applicationCommands(client.user.id),
            { body: comandos }
        );
        console.log('[SLASH] Todos os comandos instalados com sucesso!');
    } catch (error) {
        console.error('[ERRO] Falha ao registrar comandos:', error);
    }
});

if (TOKEN) {
    client.login(TOKEN);
} else {
    console.log("[AVISO] DISCORD_TOKEN faltando.");
}
