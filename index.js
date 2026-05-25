const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const FILE_PATH = './config-zyphor.json';

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
    
    // Envia log para o canal de punições se estiver definido
    if (db.canal_punicoes !== 'Não definido') {
        const idCanal = db.canal_punicoes.replace(/[<#>]/g, '');
        const canalLog = client.channels.cache.get(idCanal);
        if (canalLog) {
            try {
                await canalLog.send(`<:martelo:1503163618273792050> **Usuário Banido:** <@${userId}> (\`${userId}\`)\n<:alerta:1501991676628041859> **Motivo:** ${motivo}`);
            } catch(e) {}
        }
    }

    for (const guild of client.guilds.cache.values()) {
        try { 
            await guild.members.ban(userId, { reason: `Zyphor Security: ${motivo}` }); 
        } catch (error) {
            continue;
        }
    }
}

// 🛡️ SISTEMAS DE PROTEÇÃO AUTOMÁTICA
client.on('guildMemberAdd', async (member) => {
    if (!db.status_entrada) return;
    if (member.user.bot) return;

    if (checarSeEhInvasor(member.user.username) || checarSeEhInvasor(member.displayName)) {
        await aplicarBanimentoGlobal(member.id, 'Conta com assinatura de ataque na entrada.');
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!db.status_voz) return;
    if (!oldState.channelId && newState.channelId) {
        const member = newState.member;
        if (!member || member.user.bot) return;

        const dadosCall = `${member.user.username} ${member.displayName} ${member.nickname || ''}`;
        if (checarSeEhInvasor(dadosCall)) {
            await aplicarBanimentoGlobal(member.id, 'Filtro automático em canal de voz.');
        }
    }
});

// FUNÇÃO PARA GERAR A EMBED DO PAINEL PRINCIPAL
function gerarEmbedPainel() {
    return new EmbedBuilder()
        .setTitle('Zyphor BOTS ⚙️')
        .setDescription(
            `🛠️ *Informações sobre o sistema:*\n` +
            `<:status:1503163485264285776> **Status:** Ativado\n\n` +
            `**⚙️ Painel de Proteção:**\n` +
            `${db.status_entrada ? '🟢' : '🔴'} Anti-Raid Entrada: **${db.status_entrada ? 'ATIVADO' : 'DESATIVADO'}**\n` +
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
}

function gerarComponentesPainel() {
    const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('toggle_entrada')
            .setLabel('Alternar Entrada')
            .setStyle(db.status_entrada ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('toggle_voz')
            .setLabel('Alternar Filtro Voz')
            .setStyle(db.status_voz ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('atualizar_painel')
            .setLabel('🔄 Atualizar Lista')
            .setStyle(ButtonStyle.Secondary)
    );

    const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('menu-config')
            .setPlaceholder('Selecione para definir os canais do Bot.')
            .addOptions([
                { label: 'Definir Canal de Entrada', value: 'set_entrada' },
                { label: 'Definir Canal de Saída', value: 'set_saida' },
                { label: 'Definir Canal de Mensagens', value: 'set_mensagens' },
                { label: 'Definir Canal de Voz', value: 'set_voz' },
                { label: 'Definir Canal de Punições (Bans)', value: 'set_bans' }
            ])
    );

    return [botoes, menu];
}

// 🛠️ PROCESSAMENTO DE INTERAÇÕES E SLASH COMMANDS
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'configurar') {
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: `<:erro:1508472500495974600> Apenas administradores.`, ephemeral: true });
            }
            const components = gerarComponentesPainel();
            return interaction.reply({ embeds: [gerarEmbedPainel()], components: components });
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
                return interaction.reply({ content: `<:erro:1508472500495974600> Sem permissão.`, ephemeral: true });
            }
            const quantidade = interaction.options.getInteger('quantidade');
            await interaction.deferReply({ ephemeral: true });
            try {
                await interaction.channel.bulkDelete(quantidade, true);
                return interaction.editReply({ content: `<:martelo:1503163618273792050> Limpeza concluída!` });
            } catch (err) {
                return interaction.editReply({ content: `<:erro:1508472500495974600> Erro ao limpar.` });
            }
        }
    }

    // INTERAÇÕES DOS BOTÕES LIGA/DESLIGA E ATUALIZAR
    if (interaction.isButton()) {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: 'Sem permissão.', ephemeral: true });
        }

        if (interaction.customId === 'toggle_entrada') {
            db.status_entrada = !db.status_entrada;
            salvarDados();
            await interaction.update({ embeds: [gerarEmbedPainel()], components: gerarComponentesPainel() });
        }

        if (interaction.customId === 'toggle_voz') {
            db.status_voz = !db.status_voz;
            salvarDados();
            await interaction.update({ embeds: [gerarEmbedPainel()], components: gerarComponentesPainel() });
        }

        if (interaction.customId === 'atualizar_painel') {
            await interaction.update({ embeds: [gerarEmbedPainel()], components: gerarComponentesPainel() });
        }
    }

    // INTERAÇÕES DO MENU DE SELEÇÃO DE CANAIS
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'menu-config') {
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: 'Sem permissão.', ephemeral: true });
            }

            const salaAtual = interaction.channel.toString();
            const escolha = interaction.values[0];

            if (escolha === 'set_entrada') db.canal_entrada = salaAtual;
            if (escolha === 'set_saida') db.canal_saida = salaAtual;
            if (escolha === 'set_mensagens') db.canal_mensagens = salaAtual;
            if (escolha === 'set_voz') db.canal_voz = salaAtual;
            if (escolha === 'set_bans') db.canal_punicoes = salaAtual;

            salvarDados();
            return interaction.reply({ content: `✅ Este canal foi configurado no sistema! Clique no botão **🔄 Atualizar Lista** no painel principal para atualizar a visualização.`, ephemeral: true });
        }
    }
});

// REGISTRO DOS COMANDOS NO DISCORD
client.on('ready', async () => {
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);
    console.log(`[ONLINE] Zyphor Sistema Completo Ativo.`);
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);

    const comandos = [
        new SlashCommandBuilder().setName('configurar').setDescription('⚙️ Abre o painel completo interativo de canais e proteção.'),
        new SlashCommandBuilder().setName('ping').setDescription('🏓 Latência do bot.'),
        new SlashCommandBuilder().setName('dev').setDescription('👑 Informações do criador.'),
        new SlashCommandBuilder().setName('clear').setDescription('🧹 Limpa mensagens.').addIntegerOption(o => o.setName('quantidade').setDescription('1-100').setRequired(true))
    ].map(cmd => cmd.toJSON());

    try {
        await new REST({ version: '10' }).setToken(TOKEN).put(
            Routes.applicationCommands(client.user.id),
            { body: comandos }
        );
    } catch (e) {}
});

if (TOKEN) client.login(TOKEN);

