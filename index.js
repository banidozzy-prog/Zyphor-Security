const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes, 
    StringSelectMenuBuilder, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits 
} = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ] 
});

// Banco de dados dinâmico por Servidor - Sem nada chumbado no código
const db = new Map();

function getGuildConfig(guildId) {
    if (!db.has(guildId)) {
        db.set(guildId, {
            // Moderação e Cargos
            cargo_suporte: null,
            cargo_admin: null,
            msg_entrada: "Seja bem-vindo(a) ao servidor, {membro}!",
            msg_saida: "{membro} saiu do servidor.",
            canal_entrada: null,
            canal_saida: null,
            // Logs específicas
            logs_ticket: null,
            logs_mensagens: null,
            logs_punicoes: null,
            logs_cargos: null,
            // Tickets
            opcoes_ticket: [] // [{ label, description, tipo (topico/texto) }]
        });
    }
    return db.get(guildId);
}

const commands = [
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Painel de Configuração Mestre do Bot')
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        // Registra globalmente ou na sua guilda principal
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('🚀 Super Painel de Configuração Ativo e Pronto!');
    } catch (error) { console.error(error); }
});

// ==================== EXECUÇÃO DO COMANDO PAINEL ====================
client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = getGuildConfig(i.guild.id);

    // Bloqueio de segurança: Apenas quem tem permissão de Administrador ou o cargo Admin configurado pode mexer
    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator) && i.member.roles.cache.has(config.cargo_admin)) {
            return i.reply({ content: "❌ Você não tem permissão para gerenciar as configurações deste bot.", ephemeral: true });
        }

        const embedPrincipal = new EmbedBuilder()
            .setTitle('⚙️ Central de Gerenciamento e Configuração')
            .setDescription('Selecione uma categoria abaixo para editar as diretrizes, canais de logs, mensagens do sistema e opções de tickets do bot de forma dinâmica.')
            .setColor('#4f46e5')
            .addFields(
                { name: '🛡️ Módulo de Moderação & Boas-Vindas', value: 'Configure os cargos administrativos, cargo de suporte técnico e as mensagens/canais de entrada e saída.', inline: false },
                { name: '📋 Diretório de Logs', value: 'Defina canais separados para auditoria de tickets, mensagens apagadas/editadas, bans e logs de cargos.', inline: false },
                { name: '🎫 Sistema de Tickets', value: 'Crie categorias de atendimento, defina se o canal será do tipo Tópico ou Chat Normal e envie o painel aos membros.', inline: false }
            );

        const menuMestre = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('menu_mestre_config')
                .setPlaceholder('Escolha o módulo que deseja configurar...')
                .addOptions([
                    { label: 'Moderação & Boas-Vindas', value: 'mod_config', emoji: '🛡️' },
                    { label: 'Diretório de Logs', value: 'logs_config', emoji: '📋' },
                    { label: 'Configuração de Tickets', value: 'tickets_config', emoji: '🎫' }
                ])
        );

        await i.reply({ embeds: [embedPrincipal], components: [menuMestre] });
    }

    // ==================== INTERAÇÕES DO MENU MESTRE ====================
    if (i.isStringSelectMenu() && i.customId === 'menu_mestre_config') {
        const categoria = i.values[0];

        if (categoria === 'mod_config') {
            const embedMod = new EmbedBuilder()
                .setTitle('🛡️ Configuração de Moderação & Membros')
                .setDescription('Configure as restrições de cargos e o sistema de avisos de entrada e saída do servidor.')
                .setColor('#ff4757')
                .addFields(
                    { name: '👤 Cargo Admin (Comandos Bot):', value: config.cargo_admin ? `<@&${config.cargo_admin}>` : '*Não definido (Apenas Admins nativos)*', inline: true },
                    { name: '🎫 Cargo Suporte (Atende Tickets):', value: config.cargo_suporte ? `<@&${config.cargo_suporte}>` : '*Não definido*', inline: true },
                    { name: '🚪 Canais de Entrada/Saída:', value: `**Entrada:** ${config.canal_entrada ? `<#${config.canal_entrada}>` : '*Não definido*'}\n**Saída:** ${config.canal_saida ? `<#${config.canal_saida}>` : '*Não definido*'}`, inline: false },
                    { name: '💬 Mensagem de Entrada:', value: `\`\`\`${config.msg_entrada}\`\`\`` },
                    { name: '💬 Mensagem de Saída:', value: `\`\`\`${config.msg_saida}\`\`\`` }
                );

            const botoesMod = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('set_cargos_btn').setLabel('Configurar Cargos').setStyle(ButtonStyle.Primary).setEmoji('👥'),
                new ButtonBuilder().setCustomId('set_welcome_btn').setLabel('Configurar Entrada/Saída').setStyle(ButtonStyle.Success).setEmoji('🚪')
            );

            await i.reply({ embeds: [embedMod], components: [botoesMod], ephemeral: true });
        }

        if (categoria === 'logs_config') {
            const embedLogs = new EmbedBuilder()
                .setTitle('📋 Configuração do Sistema de Logs')
                .setDescription('Defina canais individuais para monitorar as ações executadas no servidor.')
                .setColor('#ffa502')
                .addFields(
                    { name: '🎫 Logs de Tickets:', value: config.logs_ticket ? `<#${config.logs_ticket}>` : '*Não definido*', inline: true },
                    { name: '💬 Logs de Mensagens (Editadas/Apagadas):', value: config.logs_mensagens ? `<#${config.logs_mensagens}>` : '*Não definido*', inline: true },
                    { name: '🔨 Logs de Punições (Bans/Kicks):', value: config.logs_punicoes ? `<#${config.logs_punicoes}>` : '*Não definido*', inline: true },
                    { name: '👑 Logs de Cargos (Alterações):', value: config.logs_cargos ? `<#${config.logs_cargos}>` : '*Não definido*', inline: true }
                );

            const botaoLogs = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('editar_logs_btn').setLabel('Definar Canais de Logs').setStyle(ButtonStyle.Primary).setEmoji('🛠️')
            );

            await i.reply({ embeds: [embedLogs], components: [botaoLogs], ephemeral: true });
        }

        if (categoria === 'tickets_config') {
            let txtOpcoes = config.opcoes_ticket.length > 0 
                ? config.opcoes_ticket.map((o, idx) => `**${idx + 1}️⃣ ${o.label}** [Tipo: *${o.tipo}*]\n└ *${o.description}*`).join('\n\n') 
                : '*Nenhuma opção de ticket configurada para este servidor.*';

            const embedTicket = new EmbedBuilder()
                .setTitle('🎫 Gerenciamento de Opções do Ticket')
                .setDescription(`Configure as opções que os membros terão ao abrir chamados de suporte.\n\n${txtOpcoes}`)
                .setColor('#2ed573');

            const botoesTicket = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_ticket_opcao').setLabel('Adicionar Opção').setStyle(ButtonStyle.Primary).setEmoji('➕'),
                new ButtonBuilder().setCustomId('limpar_ticket_opcoes').setLabel('Limpar Tudo').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
                new ButtonBuilder().setCustomId('enviar_painel_membros').setLabel('Enviar Painel para Membros').setStyle(ButtonStyle.Success).setEmoji('📢')
            );

            await i.reply({ embeds: [embedTicket], components: [botoesTicket], ephemeral: true });
        }
    }

    // ==================== GESTÃO DE MODAIS (SALVAMENTO DINÂMICO) ====================
    if (i.isButton()) {
        if (i.customId === 'set_cargos_btn') {
            const modal = new ModalBuilder().setCustomId('modal_cargos').setTitle('Configurar Cargos do Bot');
            const inputAdmin = new TextInputBuilder().setCustomId('in_admin').setLabel('ID do Cargo Admin (Comandos Bot)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder(config.cargo_admin || '');
            const inputSuporte = new TextInputBuilder().setCustomId('in_suporte').setLabel('ID do Cargo Suporte (Atende Tickets)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(config.cargo_suporte || '');
            
            modal.addComponents(new ActionRowBuilder().addComponents(inputAdmin), new ActionRowBuilder().addComponents(inputSuporte));
            await i.showModal(modal);
        }

        if (i.customId === 'set_welcome_btn') {
            const modal = new ModalBuilder().setCustomId('modal_welcome').setTitle('Configurar Entrada e Saída');
            const inCanalEntrada = new TextInputBuilder().setCustomId('in_c_ent').setLabel('ID do Canal de Entrada').setStyle(TextInputStyle.Short).setRequired(false);
            const inMsgEntrada = new TextInputBuilder().setCustomId('in_m_ent').setLabel('Mensagem de Entrada').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(config.msg_entrada);
            const inCanalSaida = new TextInputBuilder().setCustomId('in_c_sai').setLabel('ID do Canal de Saída').setStyle(TextInputStyle.Short).setRequired(false);
            const inMsgSaida = new TextInputBuilder().setCustomId('in_m_sai').setLabel('Mensagem de Saída').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(config.msg_saida);

            modal.addComponents(
                new ActionRowBuilder().addComponents(inCanalEntrada),
                new ActionRowBuilder().addComponents(inMsgEntrada),
                new ActionRowBuilder().addComponents(inCanalSaida),
                new ActionRowBuilder().addComponents(inMsgSaida)
            );
            await i.showModal(modal);
        }

        if (i.customId === 'editar_logs_btn') {
            const modal = new ModalBuilder().setCustomId('modal_logs').setTitle('Definir Canais de Logs (Insira IDs)');
            const logT = new TextInputBuilder().setCustomId('log_t').setLabel('ID Log de Tickets').setStyle(TextInputStyle.Short).setRequired(false);
            const logM = new TextInputBuilder().setCustomId('log_m').setLabel('ID Log de Mensagens (Edit/Del)').setStyle(TextInputStyle.Short).setRequired(false);
            const logP = new TextInputBuilder().setCustomId('log_p').setLabel('ID Log de Punições (Bans)').setStyle(TextInputStyle.Short).setRequired(false);
            const logC = new TextInputBuilder().setCustomId('log_c').setLabel('ID Log de Cargos').setStyle(TextInputStyle.Short).setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(logT),
                new ActionRowBuilder().addComponents(logM),
                new ActionRowBuilder().addComponents(logP),
                new ActionRowBuilder().addComponents(logC)
            );
            await i.showModal(modal);
        }

        if (i.customId === 'add_ticket_opcao') {
            const modal = new ModalBuilder().setCustomId('modal_add_ticket').setTitle('Nova Opção de Atendimento');
            const nome = new TextInputBuilder().setCustomId('t_nome').setLabel('Nome da Categoria (Ex: Compras)').setStyle(TextInputStyle.Short).setRequired(true);
            const desc = new TextInputBuilder().setCustomId('t_desc').setLabel('Descrição Breve').setStyle(TextInputStyle.Short).setRequired(true);
            const tipo = new TextInputBuilder().setCustomId('t_tipo').setLabel('Tipo de Canal: Escreva "TEXTO" ou "TOPICO"').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('TEXTO');

            modal.addComponents(new ActionRowBuilder().addComponents(nome), new ActionRowBuilder().addComponents(desc), new ActionRowBuilder().addComponents(tipo));
            await i.showModal(modal);
        }

        if (i.customId === 'limpar_ticket_opcoes') {
            config.opcoes_ticket = [];
            await i.reply({ content: '🗑️ Todas as opções de ticket foram deletadas.', ephemeral: true });
        }
    }

    // ==================== PROCESSAMENTO DOS DADOS ENVIADOS (SUBMITS) ====================
    if (i.isModalSubmit()) {
        if (i.customId === 'modal_cargos') {
            config.cargo_admin = i.fields.getTextInputValue('in_admin') || null;
            config.cargo_suporte = i.fields.getTextInputValue('in_suporte') || null;
            await i.reply({ content: '✅ Cargos de controle administrativo salvos com sucesso!', ephemeral: true });
        }

        if (i.customId === 'modal_welcome') {
            config.canal_entrada = i.fields.getTextInputValue('in_c_ent') || null;
            config.msg_entrada = i.fields.getTextInputValue('in_m_ent');
            config.canal_saida = i.fields.getTextInputValue('in_c_sai') || null;
            config.msg_saida = i.fields.getTextInputValue('in_m_sai');
            await i.reply({ content: '✅ Sistema de Boas-Vindas e Saídas atualizado com sucesso!', ephemeral: true });
        }

        if (i.customId === 'modal_logs') {
            config.logs_ticket = i.fields.getTextInputValue('log_t') || null;
            config.logs_mensagens = i.fields.getTextInputValue('log_m') || null;
            config.logs_punicoes = i.fields.getTextInputValue('log_p') || null;
            config.logs_cargos = i.fields.getTextInputValue('log_c') || null;
            await i.reply({ content: '✅ Canais das diretrizes de logs atualizados com sucesso!', ephemeral: true });
        }

        if (i.customId === 'modal_add_ticket') {
            const nomeOpcao = i.fields.getTextInputValue('t_nome');
            const descOpcao = i.fields.getTextInputValue('t_desc');
            const tipoCanal = i.fields.getTextInputValue('t_tipo').toUpperCase() === 'TOPICO' ? 'TOPICO' : 'TEXTO';

            config.opcoes_ticket.push({
                label: nomeOpcao,
                description: descOpcao,
                value: `tkt_${nomeOpcao.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                tipo: tipoCanal
            });
            await i.reply({ content: `✅ Nova categoria **"${nomeOpcao}"** integrada ao sistema com sucesso!`, ephemeral: true });
        }
    }

    // ==================== ENVIAR PAINEL DO TICKET COMPLETO PARA OS MEMBROS ====================
    if (i.isButton() && i.customId === 'enviar_painel_membros') {
        if (config.opcoes_ticket.length === 0) return i.reply({ content: '❌ Configure ao menos uma categoria válida antes de disponibilizar o painel.', ephemeral: true });

        const embedMembros = new EmbedBuilder()
            .setTitle('🎫 Central de Atendimento Privado')
            .setDescription('Selecione abaixo a categoria que melhor se enquadra na sua solicitação para iniciar um atendimento seguro e dedicado com a nossa equipe.')
            .setColor('#5865f2')
            .setFooter({ text: i.guild.name, iconURL: i.guild.iconURL() });

        const selectMembros = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('abrir_ticket_membro')
                .setPlaceholder('Escolha o motivo do seu chamado...')
                .addOptions(config.opcoes_ticket.map(o => ({ label: o.label, description: o.description, value: o.value })))
        );

        await i.channel.send({ embeds: [embedMembros], components: [selectMembros] });
        await i.reply({ content: '📢 Painel de atendimento oficial enviado com sucesso!', ephemeral: true });
    }

    // ==================== CORREÇÃO CRUCIAL: CRIAÇÃO DO TICKET 100% PRIVADO ====================
    if (i.isStringSelectMenu() && i.customId === 'abrir_ticket_membro') {
        const canalExiste = i.guild.channels.cache.find(c => c.name.includes(i.user.username.toLowerCase()));
        if (canalExiste) return i.reply({ content: '❌ Você já possui um canal de suporte ativo aberto neste servidor.', ephemeral: true });

        const opcao = config.opcoes_ticket.find(o => o.value === i.values[0]);
        const tipoCanal = opcao ? opcao.tipo : 'TEXTO';
        const nomeCategoria = opcao ? opcao.label.toLowerCase() : 'suporte';

        let canalCriado;

        // Gerenciamento se for canal de texto Normal ou Tópico (Thread)
        if (tipoCanal === 'TEXTO') {
            const permissoesIniciais = [
                { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }, // Tranca para todo mundo
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] } // Libera exclusivamente pro membro
            ];

            // Se o cargo de suporte estiver configurado, ele também entra de forma privada
            if (config.cargo_suporte) {
                permissoesIniciais.push({
                    id: config.cargo_suporte,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory]
                });
            }

            canalCriado = await i.guild.channels.create({
                name: `🎫-${nomeCategoria}-${i.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: permissoesIniciais
            });
        } else {
            // Criação via Tópico/Thread Pública ou Privada dentro do próprio chat
            canalCriado = await i.channel.threads.create({
                name: `🎫-${nomeCategoria}-${i.user.username}`,
                autoArchiveDuration: 1440,
                type: ChannelType.PrivateThread, // Garante que a thread seja privada e segura
                reason: `Ticket de atendimento solicitado por ${i.user.tag}`
            });
            await canalCriado.members.add(i.user.id);
            if (config.cargo_suporte) {
                // Adiciona os membros da staff manualmente se for thread privada
                const membrosStaff = await i.guild.members.fetch();
                membrosStaff.filter(m => m.roles.cache.has(config.cargo_suporte)).forEach(m => canalCriado.members.add(m.id));
            }
        }

        // Salva quem abriu o ticket usando o Topic do canal (ou no db se for thread)
        if (canalCriado.type === ChannelType.GuildText) canalCriado.setTopic(i.user.id);

        const embedInterno = new EmbedBuilder()
            .setTitle(`🎫 Atendimento Iniciado | Categoria: ${nomeCategoria.toUpperCase()}`)
            .setDescription(`Olá ${i.user}, este canal é privado e exclusivo para o seu atendimento.\n\nPor favor, envie todas as informações, prints e detalhes sobre o seu problema abaixo para que a nossa equipe possa agilizar seu caso.`)
            .setColor('#2ecc71')
            .setTimestamp();

        const rowAcoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('assumir_ticket_btn').setLabel('Assumir Chamado').setStyle(ButtonStyle.Success).setEmoji('🤝'),
            new ButtonBuilder().setCustomId('fechar_ticket_btn').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await canalCriado.send({ embeds: [embedInterno], components: [rowAcoes] });
        await i.reply({ content: `✅ Canal de suporte gerado com segurança e privacidade! Siga para: ${canalCriado}`, ephemeral: true });
    }

    // ==================== ASSUMIR CHAMADO ====================
    if (i.isButton() && i.customId === 'assumir_ticket_btn') {
        if (config.cargo_suporte && !i.member.roles.cache.has(config.cargo_suporte) && !i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({ content: '❌ Apenas membros com o cargo de suporte configurado podem assumir este ticket.', ephemeral: true });
        }

        const btnDesabilitado = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('assumir_ticket_btn').setLabel(`Assumido por ${i.user.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('fechar_ticket_btn').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger)
        );

        await i.message.edit({ components: [btnDesabilitado] });
        await i.channel.send({ content: `🤝 O moderador ${i.user} assumiu a responsabilidade por este ticket e responderá em breve.` });
        await i.reply({ content: 'Você assumiu o atendimento!', ephemeral: true });
    }

    // ==================== ENCERRAMENTO COM LOG COMPLETA ====================
    if (i.isButton() && i.customId === 'fechar_ticket_btn') {
        if (config.cargo_suporte && !i.member.roles.cache.has(config.cargo_suporte) && !i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({ content: '❌ Você não possui permissão para encerrar chamados.', ephemeral: true });
        }

        await i.reply({ content: '🔒 Arquivando dados e excluindo o canal de suporte...' });

        // Compila o histórico completo de conversas do ticket
        const logsCanal = config.logs_ticket ? i.guild.channels.cache.get(config.logs_ticket) : null;
        if (logsCanal) {
            const mensagens = await i.channel.messages.fetch({ limit: 100 });
            let logsTexto = `LOG DE ATENDIMENTO - CANAL: ${i.channel.name}\n\n`;
            
            mensagens.reverse().forEach(m => {
                logsTexto += `[${m.createdAt.toLocaleString('pt-BR')}] ${m.author.tag}: ${m.content}\n`;
            });

            const arquivo = new AttachmentBuilder(Buffer.from(logsTexto, 'utf-8'), { name: `log-${i.channel.name}.txt` });
            const embedLogFinal = new EmbedBuilder()
                .setTitle('📁 Ticket Encerrado e Registrado')
                .addFields(
                    { name: 'Identificação:', value: `\`${i.channel.name}\``, inline: true },
                    { name: 'Fechado por:', value: `${i.user}`, inline: true }
                )
                .setColor('#ff4757')
                .setTimestamp();

            await logsCanal.send({ embeds: [embedLogFinal], files: [arquivo] });
        }

        setTimeout(() => i.channel.delete().catch(() => {}), 3000);
    }
});

// ==================== DISPARADORES DE EVENTOS DE LOGS REAL-TIME ====================

// Log de Mensagens Apagadas e Editadas
client.on('messageDelete', async (m) => {
    if (!m.guild || m.author?.bot) return;
    const config = getGuildConfig(m.guild.id);
    const canal = m.guild.channels.cache.get(config.logs_mensagens);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Mensagem Apagada')
        .setDescription(`**Autor:** ${m.author}\n**Canal:** ${m.channel}`)
        .addFields({ name: 'Conteúdo:', value: m.content || '*Sem conteúdo legível (Apenas mídia)*' })
        .setColor('#ff4757').setTimestamp();
    canal.send({ embeds: [embed] });
});

client.on('messageUpdate', async (antiga, nova) => {
    if (!antiga.guild || antiga.author?.bot || antiga.content === nova.content) return;
    const config = getGuildConfig(antiga.guild.id);
    const canal = antiga.guild.channels.cache.get(config.logs_mensagens);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setTitle('📝 Mensagem Editada')
        .setDescription(`**Autor:** ${antiga.author}\n**Canal:** ${antiga.channel}`)
        .addFields(
            { name: 'Antes:', value: antiga.content || '*Vazio*' },
            { name: 'Depois:', value: nova.content || '*Vazio*' }
        )
        .setColor('#ffa502').setTimestamp();
    canal.send({ embeds: [embed] });
});

// Mensagem Real de Entrada e Saída (Com substituição de variáveis)
client.on('guildMemberAdd', async (membro) => {
    const config = getGuildConfig(membro.guild.id);
    const canal = membro.guild.channels.cache.get(config.canal_entrada);
    if (!canal) return;

    const textoFormatado = config.msg_entrada.replace('{membro}', `${membro.user}`);
    canal.send({ content: textoFormatado });
});

client.on('guildMemberRemove', async (membro) => {
    const config = getGuildConfig(membro.guild.id);
    const canal = membro.guild.channels.cache.get(config.canal_saida);
    if (!canal) return;

    const textoFormatado = config.msg_saida.replace('{membro}', `${membro.user.tag}`);
    canal.send({ content: textoFormatado });
});

// Logs de Punições (Bans)
client.on('guildBanAdd', async (ban) => {
    const config = getGuildConfig(ban.guild.id);
    const canal = ban.guild.channels.cache.get(config.logs_punicoes);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setTitle('🔨 Membro Banido')
        .setDescription(`**Usuário:** ${ban.user.tag} (\`${ban.user.id}\`)\n**Razão:** ${ban.reason || 'Nenhuma razão informada.'}`)
        .setColor('#ff4757').setTimestamp();
    canal.send({ embeds: [embed] });
});

// Logs de Alteração de Cargos
client.on('guildMemberUpdate', async (antigo, novo) => {
    const config = novo.guild.getGuildConfig ? getGuildConfig(novo.guild.id) : getGuildConfig(novo.guild.id);
    const canal = novo.guild.channels.cache.get(config.logs_cargos);
    if (!canal) return;

    if (antigo.roles.cache.size !== novo.roles.cache.size) {
        const embed = new EmbedBuilder()
            .setTitle('👑 Cargos Atualizados')
            .setDescription(`Os cargos do usuário ${novo.user} foram modificados administrativamente.`)
            .setColor('#3498db').setTimestamp();

        const adicionados = novo.roles.cache.filter(r => !antigo.roles.cache.has(r.id));
        const removidos = antigo.roles.cache.filter(r => !novo.roles.cache.has(r.id));

        if (adicionados.size > 0) embed.addFields({ name: '➕ Cargos Adicionados:', value: adicionados.map(r => `<@&${r.id}>`).join(', ') });
        if (removidos.size > 0) embed.addFields({ name: '➖ Cargos Removidos:', value: removidos.map(r => `<@&${r.id}>`).join(', ') });

        canal.send({ embeds: [embed] });
    }
});

client.login(process.env.DISCORD_TOKEN);

