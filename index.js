const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// CONFIGURAÇÕES - Coloque aqui os IDs reais do seu servidor do Discord
const ID_CANAL_LOGS = 'ID_DO_SEU_CANAL_DE_LOGS'; 
const ID_CARGO_SUPORTE = 'ID_DO_CARGO_DA_STAFF';
const ID_CATEGORIA_TICKET = 'ID_DA_CATEGORIA_DOS_TICKETS';

client.once('ready', () => {
    console.log(`🤖 Bot ${client.user.tag} está online e pronto para os tickets!`);
});

// ==========================================
// 1. EVENTO DE CRIAÇÃO E ATENDIMENTO (BOTÕES)
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // --- BOTÃO: ABRIR TICKET ---
    if (interaction.customId === 'abrir_ticket') {
        await interaction.deferReply({ ephemeral: true });

        const idQuemAbriu = interaction.user.id;
        const guild = interaction.guild;

        // Cria o canal de texto do ticket dentro da categoria
        const canalTicket = await guild.channels.create({
            name: `🎫-suporte-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: ID_CATEGORIA_TICKET,
            permissionOverwrites: [
                { id: guild.id, deny: ['ViewChannel'] }, 
                { id: idQuemAbriu, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }, 
                { id: ID_CARGO_SUPORTE, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] } 
            ]
        });

        // Embed de boas-vindas dentro do canal do ticket
        const embedTicket = new EmbedBuilder()
            .setTitle('🎯 Atendimento Aberto | Categoria: SUPORTE')
            .setDescription(`Seja bem-vindo, <@${idQuemAbriu}>!\n\nEste espaço foi reservado para o seu atendimento de forma segura. Detalhe seu problema enviando textos e mídias para que a nossa equipe possa te responder o mais rápido possível.`)
            .setColor('#00ff00')
            .setTimestamp();

        // Cria os botões de controle do ticket
        const botoesTicket = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`assumir_${idQuemAbriu}`).setLabel('Assumir Chamado').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('fechar_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger)
        );

        // MARCA O USUÁRIO QUE ABRIU E A STAFF LOGO NA ENTRADA DO TICKET
        await canalTicket.send({ 
            content: `👋 Olá <@${idQuemAbriu}>, seu ticket foi criado com sucesso! \n🔔 <@&${ID_CARGO_SUPORTE}> um novo atendimento aguarda suporte.` 
        });

        // Envia a Embed principal com os botões logo abaixo das marcações
        await canalTicket.send({ embeds: [embedTicket], components: [botoesTicket] });

        // LOG DE ABERTURA: Registra no canal de logs marcando quem ABRIU
        const canalLog = guild.channels.cache.get(ID_CANAL_LOGS);
        if (canalLog) {
            const embedAbertura = new EmbedBuilder()
                .setTitle('🎫 Novo Ticket Criado')
                .setDescription(`Um cliente abriu um novo chamado de suporte.`)
                .addFields(
                    { name: '👤 Quem Abriu:', value: `<@${idQuemAbriu}>`, inline: true },
                    { name: '📁 Canal:', value: `<#${canalTicket.id}>`, inline: true }
                )
                .setColor('#00ff00')
                .setTimestamp();

            await canalLog.send({ content: `🆕 Ticket aberto por: <@${idQuemAbriu}>`, embeds: [embedAbertura] });
        }

        await interaction.editReply({ content: `Seu ticket foi criado com sucesso em ${canalTicket}!`, ephemeral: true });
    }

    // --- BOTÃO: ASSUMIR CHAMADO ---
    if (interaction.customId.startsWith('assumir_')) {
        // Recupera o ID do dono do ticket que salvamos no customId do botão
        const idDonoTicket = interaction.customId.split('_')[1];
        const idStaffAtendeu = interaction.user.id;
        const canalLog = interaction.guild.channels.cache.get(ID_CANAL_LOGS);

        // Altera o texto do chat do ticket avisando quem assumiu e remove os botões antigos
        await interaction.update({
            content: `O ticket agora está sendo atendido por <@${idStaffAtendeu}>!`,
            components: [] 
        });

        // LOG DE ATENDIMENTO: Registra no canal de logs marcando quem ATENDEU
        if (canalLog) {
            const embedAtendimento = new EmbedBuilder()
                .setTitle('🛠️ Ticket em Atendimento')
                .setDescription(`Um membro da equipe assumiu o suporte deste canal.`)
                .addFields(
                    { name: '👷 Quem Atendeu:', value: `<@${idStaffAtendeu}>`, inline: true },
                    { name: '👤 Dono do Ticket:', value: `<@${idDonoTicket}>`, inline: true },
                    { name: '📁 Canal:', value: `<#${interaction.channel.id}>`, inline: true }
                )
                .setColor('#ffaa00')
                .setTimestamp();

            await canalLog.send({ content: `⚡ Staff <@${idStaffAtendeu}> assumiu o suporte do canal <#${interaction.channel.id}>`, embeds: [embedAtendimento] });
        }
    }

    // --- BOTÃO: FECHAR TICKET ---
    if (interaction.customId === 'fechar_ticket') {
        await interaction.reply({ content: 'Fechando este ticket em 5 segundos...' });
        setTimeout(() => {
            interaction.channel.delete().catch(() => {});
        }, 5000);
    }
});

// ==========================================
// 2. EVENTO DE SISTEMA DE NOTIFICAÇÕES (MENSAGENS)
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Verifica se a mensagem está em um canal de ticket
    if (message.channel.name.startsWith('🎫-suporte-')) {
        
        // Descobre quem é o dono do ticket com base em quem tem permissão explícita na sala
        const permissões = message.channel.permissionOverwrites.cache;
        let idDonoTicket = null;

        permissões.forEach((overwrite) => {
            // Filtra para achar o ID do usuário comum (que não é o cargo da staff e nem @everyone)
            if (overwrite.type === 1 && overwrite.id !== ID_CARGO_SUPORTE && overwrite.id !== message.guild.id) {
                idDonoTicket = overwrite.id;
            }
        });

        if (!idDonoTicket) return;

        // Se quem mandou a mensagem foi o próprio dono do ticket, o bot não faz nada
        if (message.author.id === idDonoTicket) return;

        // NOTIFICAÇÃO 1: Marca o usuário no chat do ticket para gerar o alerta visual interno
        try {
            const avisoChat = await message.channel.send({ content: `<@${idDonoTicket}>, a staff te respondeu aqui no canal!` });
            // Deleta o ping após 5 segundos para manter o histórico limpo e organizado
            setTimeout(() => avisoChat.delete().catch(() => {}), 5000); 
        } catch (err) {
            console.error("Erro ao marcar o usuário dentro do chat do ticket.");
        }

        // NOTIFICAÇÃO 2: Envia uma mensagem direta (DM) para o usuário com o link do canal
        try {
            const membro = await client.users.fetch(idDonoTicket);
            
            const embedDM = new EmbedBuilder()
                .setTitle('🎯 Nova resposta no seu Ticket!')
                .setDescription(`Olá! Alguém da equipe do servidor **${message.guild.name}** acabou de responder ao seu atendimento.`)
                .addFields({ name: 'Clique para ir direto ao canal:', value: `<#${message.channel.id}>` }) 
                .setColor('#2b2d31')
                .setTimestamp();

            await membro.send({ embeds: [embedDM] });
        } catch (err) {
            console.log(`Usuário <@${idDonoTicket}> está com a DM trancada. Notificação feita apenas pelo chat.`);
        }
    }
});

// Substitua pelo Token do seu Bot obtido no Discord Developer Portal
client.login('SEU_TOKEN_AQUI');
