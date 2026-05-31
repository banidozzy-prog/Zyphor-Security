const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes, 
    StringSelectMenuBuilder, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] 
});

// Banco de dados em memória que agora suporta as opções customizadas por você
const db = { 
    canal_logs: {}, 
    hora_abertura: {}, 
    hora_fechamento: {}, 
    historico: {},
    opcoes_menu: {} // Guarda as opções que VOCÊ criar
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
        console.log('✅ Bot Totalmente Configurável Online!');
    } catch (error) { console.error(error); }
});

client.on('interactionCreate', async (i) => {
    const gid = i.guild?.id;

    // COMANDO /LOGS
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

    // COMANDO /CONFIGURAR
    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        const embed = new EmbedBuilder().setTitle('⚙️ Configuração Principal').setDescription('Escolha uma categoria abaixo:').setColor('#5865F2');
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu_config').setPlaceholder('Selecione uma opção')
                .addOptions([
                    { label: 'Logs', value: 'c_logs', emoji: '📋' },
                    { label: 'Horário', value: 'c_hora', emoji: '🕒' },
                    { label: 'Gerenciar Opções do Menu', value: 'c_opcoes', emoji: '⚙️' },
                    { label: 'Enviar Painel do Ticket', value: 'c_ticket', emoji: '🎫' }
                ])
        );
        await i.reply({ embeds: [embed], components: [menu] });
    }

    // INTERAÇÕES DO MENU DE CONFIGURAÇÃO
    if (i.isStringSelectMenu() && i.customId === 'menu_config') {
        const valor = i.values[0];

        if (valor === 'c_logs') {
            db.canal_logs[gid] = i.channel.id;
            await i.reply({ content: `✅ Canal <#${i.channel.id}> definido para logs!`, ephemeral: true });
        }

        if (valor === 'c_hora') {
            const embed = new EmbedBuilder().setTitle('🕒 Definir Horários').setColor('Orange');
            const mAbertura = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('set_open').setPlaceholder('Horário de ABERTURA')
                    .addOptions([{ label: '08:00 AM', value: '8' }, { label: '09:00 AM', value: '9' }, { label: '10:00 AM', value: '10' }])
            );
            const mFechamento = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('set_close').setPlaceholder('Horário de FECHAMENTO')
                    .addOptions([{ label: '18:00 PM', value: '18' }, { label: '20:00 PM', value: '20' }, { label: '22:00 PM', value: '22' }])
            );
            await i.reply({ embeds: [embed], components: [mAbertura, mFechamento], ephemeral: true });
        }

        // NOVO: SISTEMA VISUAL PARA ADICIONAR OU REMOVER NOMES DO MENU
        if (valor === 'c_opcoes') {
            const listagem = db.opcoes_menu[gid] || [];
            let txtOpcoes = listagem.length > 0 ? listagem.map((o, idx) => `🔹 **${idx + 1}. ${o.label}** - *${o.description}*`).join('\n') : '❌ Nenhuma opção configurada ainda (O menu está vazio).';

            const embedOpcoes = new EmbedBuilder()
                .setTitle('⚙️ Gerenciar Opções do Menu de Tickets')
                .setDescription(`Essas são as opções atuais que aparecem para os membros:\n\n${txtOpcoes}`)
                .setColor('Blurple');

            const botoes = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_opcao_btn').setLabel('Adicionar Opção').setStyle(ButtonStyle.Success).setEmoji('➕'),
                new ButtonBuilder().setCustomId('del_opcao_btn').setLabel('Resetar/Limpar Tudo').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );

            await i.reply({ embeds: [embedOpcoes], components: [botoes], ephemeral: true });
        }

        if (valor === 'c_ticket') {
            const listagem = db.opcoes_menu[gid] || [];
            if (listagem.length === 0) return i.reply({ content: '❌ Você não pode enviar o painel sem antes configurar pelo menos uma opção no menu! Vá em "Gerenciar Opções do Menu".', ephemeral: true });

            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_gerar').setLabel('Gerar Painel de Atendimento').setStyle(ButtonStyle.Success));
            await i.reply({ content: 'Clique abaixo para enviar o painel neste canal.', components: [btn], ephemeral: true });
        }
    }

    if (i.isStringSelectMenu() && i.customId === 'set_open') {
        db.hora_abertura[gid] = parseInt(i.values[0]);
        await i.reply({ content: `✅ Abertura: **${i.values[0]}:00h**`, ephemeral: true });
    }

    if (i.isStringSelectMenu() && i.customId === 'set_close') {
        db.hora_fechamento[gid] = parseInt(i.values[0]);
        await i.reply({ content: `✅ Fechamento: **${i.values[0]}:00h**`, ephemeral: true });
    }

    // AÇÃO DE ADICIONAR OPÇÃO (ABRE UM MODAL/FORMULÁRIO)
    if (i.isButton() && i.customId === 'add_opcao_btn') {
        const modal = new ModalBuilder().setCustomId('modal_add_opcao').setTitle('Nova Opção do Menu');

        const inputNome = new TextInputBuilder().setCustomId('input_nome').setLabel('Nome da Opção (Ex: Suporte VIP, Compras)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(25);
        const inputDesc = new TextInputBuilder().setCustomId('input_desc').setLabel('Descrição (O que essa opção faz?)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);

        modal.addComponents(new ActionRowBuilder().addComponents(inputNome), new ActionRowBuilder().addComponents(inputDesc));
        await i.showModal(modal);
    }

    // LIMPAR TODAS AS OPÇÕES DO MENU
    if (i.isButton() && i.customId === 'del_opcao_btn') {
        db.opcoes_menu[gid] = [];
        await i.reply({ content: '🗑️ Todas as opções do menu foram apagadas! Lembre-se de configurar novas antes de enviar o painel.', ephemeral: true });
    }

    // RECEBIMENTO DOS DADOS DO MODAL
    if (i.isModalSubmit() && i.customId === 'modal_add_opcao') {
        const nome = i.fields.getTextInputValue('input_nome');
        const desc = i.fields.getTextInputValue('input_desc');

        if (!db.opcoes_menu[gid]) db.opcoes_menu[gid] = [];
        
        // Salva a nova opção com um valor id customizado baseado no nome
        db.opcoes_menu[gid].push({
            label: nome,
            value: `ticket_${nome.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            description: desc
        });

        await i.reply({ content: `✅ Opção **"${nome}"** adicionada com sucesso ao seu menu!`, ephemeral: true });
    }

    // ENVIAR PAINEL DO MEMBRO COM AS SUAS OPÇÕES CUSTOMIZADAS
    if (i.isButton() && i.customId === 'btn_gerar') {
        const embed = new EmbedBuilder().setTitle(`${emojis.suporte} Central de Atendimento`).setDescription('Precisa de ajuda? Escolha o tipo de suporte abaixo para abrir o seu ticket privado.').setColor('Blurple');
        
        const opcoesCustomizadas = db.opcoes_menu[gid] || [];

        const menuMembros = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('abrir_ticket_menu').setPlaceholder('Selecione o motivo do suporte...')
                .addOptions(opcoesCustomizadas) // Puxa exatamente o que você criou!
        );

        await i.channel.send({ embeds: [embed], components: [menuMembros] });
        await i.reply({ content: '✅ Painel enviado com suas opções personalizadas!', ephemeral: true });
    }

    // ABERTURA DE TICKET DINÂMICO
    if (i.isStringSelectMenu() && i.customId === 'abrir_ticket_menu') {
        const abertura = db.hora_abertura[gid] ?? 9;   
        const fechamento = db.hora_fechamento[gid] ?? 18; 

        const dataBr = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const foraDoHorario = dataBr.getDay() === 0 || dataBr.getDay() === 6 || dataBr.getHours() < abertura || dataBr.getHours() >= fechamento;

        if (foraDoHorario) {
            return i.reply({ content: `❌ **Suporte Fechado!** Nosso horário: Segunda a Sexta, das ${abertura}:00 às ${fechamento}:00.`, ephemeral: true });
        }

        if (i.guild.channels.cache.find(c => c.name.includes(i.user.username.toLowerCase()))) {
            return i.reply({ content: "❌ Você já tem um ticket aberto!", ephemeral: true });
        }
        
        // Pega o nome exato da label que você configurou para dar nome ao canal
        const opcoes = db.opcoes_menu[gid] || [];
        const selecionada = opcoes.find(o => o.value === i.values[0]);
        const nomeMotivo = selecionada ? selecionada.label.toUpperCase() : "SUPORTE";

        const canal = await i.guild.channels.create({ name: `${nomeMotivo}-${i.user.username}`, type: ChannelType.GuildText });
        canal.topic = i.user.id; 

        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("atender_ticket").setLabel("Atender Ticket").setStyle(ButtonStyle.Success).setEmoji(emojis.confirmar));
        await canal.send({ content: `📢 ${i.user} abriu um ticket de **${nomeMotivo}**.`, components: [btn] });
        await i.reply({ content: `✅ Canal criado: ${canal}`, ephemeral: true });
    }

    // ATENDER TICKET
    if (i.isButton() && i.customId === "atender_ticket") {
        if (i.message.components[0].components[0].disabled) return i.reply({ content: "❌ Já em atendimento.", ephemeral: true });
        
        await i.message.edit({ components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("atender_ticket").setLabel(`Atendido por ${i.user.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true))] });
        const btnFechar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("fechar_ticket").setLabel("Fechar Ticket").setStyle(ButtonStyle.Danger).setEmoji(emojis.proibido));
        await i.channel.send({ content: `▶️ Atendimento iniciado por ${i.user}.`, components: [btnFechar] });
        await i.reply({ content: `✅ Você assumiu o ticket!` });
    }

    // FECHAR TICKET
    if (i.isButton() && i.customId === "fechar_ticket") {
        await i.reply({ content: "🔒 Encerrando..." });

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

client.login(process.env.DISCORD_TOKEN);

