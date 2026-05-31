const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes, 
    StringSelectMenuBuilder, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] 
});

const db = { 
    canal_logs: {}, 
    historico: {},
    opcoes_menu: {} 
}; 

const emojis = { 
    criar: "<:criar:1507816968286375976>", 
    confirmar: "<:corfimar:1509027559701086258>", 
    suporte: "<:Suporte:1501991877438738477>",
    proibido: "<:proibido:1508982666056171631>"
};

const commands = [
    new SlashCommandBuilder().setName('configurar').setDescription('Painel de configuração do bot'),
    new SlashCommandBuilder().setName('logs').setDescription('Histórico de tickets de um usuário')
        .addUserOption(o => o.setName('usuario').setDescription('Usuário para consultar').setRequired(true))
];

client.once('clientReady', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, '1497693597682897094'), { body: commands });
        console.log('✅ Bot Online (Sem travas de horário)!');
    } catch (error) { console.error(error); }
});

client.on('interactionCreate', async (i) => {
    const gid = i.guild?.id;

    if (i.isChatInputCommand() && i.commandName === 'logs') {
        const alvo = i.options.getUser('usuario');
        const ticketAberto = i.guild.channels.cache.find(c => c.name === `ticket-${alvo.username.toLowerCase()}`);
        const status = ticketAberto ? `🟢 **Aberto:** ${ticketAberto}` : '🔴 Nenhum ticket aberto.';
        const fechados = db.historico[gid]?.[alvo.id] || [];
        const textoFechados = fechados.length > 0 ? fechados.map((t, idx) => `📁 **#${idx + 1}** - \`${t.data}\` por \`${t.fechadoPor}\``).join('\n') : '🔴 Nenhum histórico.';

        const embed = new EmbedBuilder().setTitle(`📋 Logs: ${alvo.username}`).setColor('Blurple')
            .addFields({ name: '📌 Status', value: status }, { name: '📜 Histórico', value: textoFechados });
        return i.reply({ embeds: [embed] });
    }

    // PAINEL DE CONFIGURAÇÃO PRINCIPAL DO BOT (MANTENDO O DESIGN DA IMAGEM 46122_2.JPG)
    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        const embedConfig = new EmbedBuilder()
            .setTitle('⚙️ Painel de Configuração')
            .setDescription('Selecione uma categoria abaixo para configurar o sistema.')
            .setImage('https://i.imgur.com/k9b6M2V.jpeg') 
            .addFields(
                { name: '📋 Logs', value: 'Configure logs de ações do servidor.', inline: false },
                { name: '🛡️ Moderação', value: 'Painel para usar comandos internos e técnicos.', inline: false },
                { name: '🎫 Ticket', value: 'Sistema de suporte e atendimento.', inline: false }
            )
            .setColor('#4f46e5');

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu_config').setPlaceholder('Selecione uma categoria')
                .addOptions([
                    { label: 'Logs', value: 'c_logs', description: 'Configurar canal de logs do sistema', emoji: '📋' },
                    { label: 'Moderação', value: 'c_mod', description: 'Menu técnico e comandos do bot', emoji: '🛡️' },
                    { label: 'Ticket', value: 'c_ticket', description: 'Configurar sistema de tickets dos membros', emoji: '🎫' }
                ])
        );
        await i.reply({ embeds: [embedConfig], components: [menu] });
    }

    if (i.isStringSelectMenu() && i.customId === 'menu_config') {
        const valor = i.values[0];

        if (valor === 'c_logs') {
            db.canal_logs[gid] = i.channel.id;
            await i.reply({ content: `📋 **Logs:** Este canal (<#${i.channel.id}>) receberá os Transcripts dos tickets fechados!`, ephemeral: true });
        }

        if (valor === 'c_mod') {
            const embedMod = new EmbedBuilder()
                .setTitle('🛡️ Moderação e Comandos do Bot')
                .setDescription('Use esta categoria para executar as funções internas do bot.')
                .setColor('Blue');

            const btnClear = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_clear_chat').setLabel('Limpar Canal (100 msgs)').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );
            await i.reply({ embeds: [embedMod], components: [btnClear], ephemeral: true });
        }

        if (valor === 'c_ticket') {
            const embedMenuTicket = new EmbedBuilder()
                .setTitle('🎫 Gerenciador do Menu do Ticket')
                .setDescription('Adicione as opções que os membros poderão escolher no menu de atendimento (Ex: Moderação, Suporte, Financeiro).')
                .setColor('Orange');

            const botoesMenu = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_opcao_btn').setLabel('Adicionar Opção').setStyle(ButtonStyle.Primary).setEmoji('➕'),
                new ButtonBuilder().setCustomId('del_opcao_btn').setLabel('Limpar Tudo').setStyle(ButtonStyle.Secondary).setEmoji('🗑️'),
                new ButtonBuilder().setCustomId('btn_gerar').setLabel('Enviar Painel para Membros').setStyle(ButtonStyle.Success).setEmoji('📢')
            );
            await i.reply({ embeds: [embedMenuTicket], components: [botoesMenu], ephemeral: true });
        }
    }

    if (i.isButton() && i.customId === 'btn_clear_chat') {
        await i.channel.bulkDelete(100, true).catch(() => {});
        await i.reply({ content: '🧹 Canal limpo com sucesso!', ephemeral: true });
    }

    // MODAL PARA GERENCIAR NOMES CUSTOMIZADOS
    if (i.isButton() && i.customId === 'add_opcao_btn') {
        const modal = new ModalBuilder().setCustomId('modal_add_opcao').setTitle('Nova Opção do Menu');
        const inputNome = new TextInputBuilder().setCustomId('input_nome').setLabel('Nome (Ex: Moderação, Dúvidas)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(25);
        const inputDesc = new TextInputBuilder().setCustomId('input_desc').setLabel('Descrição (Ex: Denuncie membros ou bugs)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
        modal.addComponents(new ActionRowBuilder().addComponents(inputNome), new ActionRowBuilder().addComponents(inputDesc));
        await i.showModal(modal);
    }

    if (i.isButton() && i.customId === 'del_opcao_btn') {
        db.opcoes_menu[gid] = [];
        await i.reply({ content: '🗑️ Todas as opções criadas para o menu dos membros foram resetadas.', ephemeral: true });
    }

    if (i.isModalSubmit() && i.customId === 'modal_add_opcao') {
        const nome = i.fields.getTextInputValue('input_nome');
        const desc = i.fields.getTextInputValue('input_desc');
        if (!db.opcoes_menu[gid]) db.opcoes_menu[gid] = [];
        db.opcoes_menu[gid].push({ label: nome, value: `ticket_${nome.toLowerCase().replace(/[^a-z0-9]/g, '')}`, description: desc });
        await i.reply({ content: `✅ Opção de atendimento **"${nome}"** salva!`, ephemeral: true });
    }

    // ENVIA O PAINEL DE TICKET DOS MEMBROS
    if (i.isButton() && i.customId === 'btn_gerar') {
        const listagem = db.opcoes_menu[gid] || [];
        if (listagem.length === 0) return i.reply({ content: '❌ Crie pelo menos uma opção pelo menu de configuração antes de enviar!', ephemeral: true });

        const embed = new EmbedBuilder().setTitle(`${emojis.suporte} Central de Atendimento`).setDescription('Precisa de ajuda? Escolha o tipo de suporte abaixo para abrir o seu ticket privado.').setColor('Blurple');
        const menuMembros = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('abrir_ticket_menu').setPlaceholder('Selecione o motivo do suporte...').addOptions(listagem));
        await i.channel.send({ embeds: [embed], components: [menuMembros] });
        await i.reply({ content: '✅ Painel de atendimento enviado!', ephemeral: true });
    }

    // ABERTURA DIRETA SEM TRAVA DE HORÁRIO
    if (i.isStringSelectMenu() && i.customId === 'abrir_ticket_menu') {
        if (i.guild.channels.cache.find(c => c.name.includes(i.user.username.toLowerCase()))) {
            return i.reply({ content: "❌ Você já tem um ticket de atendimento aberto!", ephemeral: true });
        }

        const opcoes = db.opcoes_menu[gid] || [];
        const selecionada = opcoes.find(o => o.value === i.values[0]);
        const nomeMotivo = selecionada ? selecionada.label.toUpperCase() : "SUPORTE";

        const canal = await i.guild.channels.create({ name: `${nomeMotivo}-${i.user.username}`, type: ChannelType.GuildText });
        canal.topic = i.user.id; 

        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("atender_ticket").setLabel("Atender Ticket").setStyle(ButtonStyle.Success).setEmoji(emojis.confirmar));
        await canal.send({ content: `📢 ${i.user} abriu um ticket para a categoria: **${nomeMotivo}**.`, components: [btn] });
        await i.reply({ content: `✅ Seu ticket foi gerado em: ${canal}`, ephemeral: true });
    }

    // ATENDER TICKET
    if (i.isButton() && i.customId === "atender_ticket") {
        if (i.message.components[0].components[0].disabled) return i.reply({ content: "❌ Este ticket já está sob os cuidados de outro Staff.", ephemeral: true });
        await i.message.edit({ components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("atender_ticket").setLabel(`Atendido por ${i.user.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true))] });
        const btnFechar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("fechar_ticket").setLabel("Fechar Ticket").setStyle(ButtonStyle.Danger).setEmoji(emojis.proibido));
        await i.channel.send({ content: `▶️ Atendimento iniciado por ${i.user}.`, components: [btnFechar] });
        await i.reply({ content: `✅ Você assumiu o ticket!` });
    }

    // FECHAR TICKET E ENVIAR HISTÓRICO
    if (i.isButton() && i.customId === "fechar_ticket") {
        await i.reply({ content: "🔒 Arquivando e encerrando o ticket..." });
        const mensagens = await i.channel.messages.fetch({ limit: 100 });
        const dataBr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        let txt = `Histórico - ${i.channel.name}\n\n`;
        mensagens.reverse().forEach(m => txt += `[${m.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}] ${m.author.tag}: ${m.content}\n`);

        const donoId = i.channel.topic;
        if (donoId) {
            if (!db.historico[gid]) db.historico[gid] = {};
            if (!db.historico[gid][donoId]) db.historico[gid][donoId] = [];
            db.historico[gid][donoId].push({ data: dataBr, fechadoPor: i.user.tag });
        }

        const cLogs = i.guild.channels.cache.get(db.canal_logs[gid]);
        if (cLogs) {
            const embed = new EmbedBuilder().setTitle("📁 Ticket Encerrado").setDescription(`**Canal:** ${i.channel.name}\n**Fechado por:** ${i.user.tag}`).setColor("Red");
            await cLogs.send({ embeds: [embed], files: [new AttachmentBuilder(Buffer.from(txt, "utf-8"), { name: `log-${i.channel.name}.txt` })] });
        }
        setTimeout(() => i.channel.delete().catch(() => {}), 4000);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('z!')) return;
});

client.login(process.env.DISCORD_TOKEN);

