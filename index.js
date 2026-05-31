const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes, 
    StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
    AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits 
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

// Banco de dados dinâmico por Servidor
const db = new Map();

function getGuildConfig(guildId) {
    if (!db.has(guildId)) {
        db.set(guildId, {
            cargo_suporte: null,
            cargo_admin: null,
            msg_entrada: "Seja bem-vindo(a) ao servidor, {membro}! <:sino:1510520622625849355>",
            msg_saida: "{membro} saiu do servidor. <:cancelar:1510520615956905985>",
            canal_entrada: null,
            canal_saida: null,
            logs_ticket: null,
            logs_mensagens: null,
            logs_punicoes: null,
            logs_cargos: null,
            // ONDE OS TICKETS VÃO ABRIR (Categoria ou Canal)
            local_conversas_texto: null, // ID da Categoria para canais normais
            local_conversas_topico: null, // ID do Canal para Threads
            opcoes_ticket: [] 
        });
    }
    return db.get(guildId);
}

const myEmojis = {
    suporte: "<:Suporte:1510520624274215092>",
    criar: "<:criar:1510520619630989393>",
    codigo: "<:codigo:1510520618133749821>",
    confirmar: "<:corfimar:1510520614853541979>",
    cancelar: "<:cancelar:1510520615956905985>",
    proibido: "<:proibido:1510520613452644394>",
    sino: "<:sino:1510520622625849355>"
};

const commands = [
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Painel de Configuração Mestre do Bot')
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('🚀 Sistema Avançado com Destinos de Ticket Online!');
    } catch (error) { console.error(error); }
});

client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = getGuildConfig(i.guild.id);

    // Comando configurar principal
    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator) && (config.cargo_admin && !i.member.roles.cache.has(config.cargo_admin))) {
            return i.reply({ content: `${myEmojis.proibido} Você não tem permissão para usar este comando administrativo.`, ephemeral: true });
        }

        const embedPrincipal = new EmbedBuilder()
            .setTitle(`${myEmojis.codigo} Central de Gerenciamento`)
            .setDescription('Gerencie todos os aspectos do bot utilizando os menus nativos abaixo. Sem complicações com IDs!')
            .setColor('#4f46e5')
            .addFields(
                { name: '🛡️ Módulo de Moderação & Boas-Vindas', value: 'Configure cargos administrativos e canais/mensagens de entrada e saída.', inline: false },
                { name: '📋 Diretório de Logs', value: 'Defina canais separados para monitoramento e auditoria em tempo real.', inline: false },
                { name: '🎫 Sistema de Tickets', value: 'Adicione categorias personalizadas, mude os destinos de abertura e publique o painel.', inline: false }
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

    if (i.isStringSelectMenu() && i.customId === 'menu_mestre_config') {
        const categoria = i.values[0];

        // MÓDULO DE MODERAÇÃO
        if (categoria === 'mod_config') {
            const embedMod = new EmbedBuilder()
                .setTitle('🛡️ Configuração de Moderação & Membros')
                .setColor('#ff4757')
                .addFields(
                    { name: '👤 Cargo Admin:', value: config.cargo_admin ? `<@&${config.cargo_admin}>` : '*Não definido (Apenas Admins nativos)*', inline: true },
                    { name: '🎫 Cargo Suporte:', value: config.cargo_suporte ? `<@&${config.cargo_suporte}>` : '*Não definido*', inline: true },
                    { name: '🚪 Canais:', value: `**Entrada:** ${config.canal_entrada ? `<#${config.canal_entrada}>` : '*Não definido*'}\n**Saída:** ${config.canal_saida ? `<#${config.canal_saida}>` : '*Não definido*'}`, inline: false },
                    { name: '💬 Msg Entrada:', value: `\`\`\`${config.msg_entrada}\`\`\`` },
                    { name: '💬 Msg Saída:', value: `\`\`\`${config.msg_saida}\`\`\`` }
                );

            const rowCargos = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId('sel_cargo_admin').setPlaceholder('Selecionar Cargo Admin (Comandos Bot)').setMaxValues(1)
            );
            const rowSuporte = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId('sel_cargo_suporte').setPlaceholder('Selecionar Cargo Suporte (Tickets)').setMaxValues(1)
            );
            const rowCanais = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('sel_canais_welcome').setPlaceholder('Escolher Canais de Entrada e Saída').setMinValues(1).setMaxValues(2).setChannelTypes([ChannelType.GuildText])
            );
            const rowTextoBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_msg_welcome').setLabel('Editar Mensagens de Texto').setStyle(ButtonStyle.Primary).setEmoji('📝')
            );

            await i.reply({ embeds: [embedMod], components: [rowCargos, rowSuporte, rowCanais, rowTextoBtn], ephemeral: true });
        }

        // MÓDULO DE LOGS
        if (categoria === 'logs_config') {
            const embedLogs = new EmbedBuilder()
                .setTitle('📋 Diretório de Logs do Servidor')
                .setColor('#ffa502')
                .addFields(
                    { name: '🎫 Logs de Tickets:', value: config.logs_ticket ? `<#${config.logs_ticket}>` : '*Não definido*', inline: true },
                    { name: '💬 Logs de Mensagens:', value: config.logs_mensagens ? `<#${config.logs_mensagens}>` : '*Não definido*', inline: true },
                    { name: '🔨 Logs de Punições:', value: config.logs_punicoes ? `<#${config.logs_punicoes}>` : '*Não definido*', inline: true },
                    { name: '👑 Logs de Cargos:', value: config.logs_cargos ? `<#${config.logs_cargos}>` : '*Não definido*', inline: true }
                );

            const rowSelLogs1 = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('sel_logs_principais').setPlaceholder('Definir Logs de Tickets e Mensagens').setMinValues(2).setMaxValues(2).setChannelTypes([ChannelType.GuildText])
            );
            const rowSelLogs2 = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('sel_logs_seguranca').setPlaceholder('Definir Logs de Punições e Cargos').setMinValues(2).setMaxValues(2).setChannelTypes([ChannelType.GuildText])
            );

            await i.reply({ embeds: [embedLogs], components: [rowSelLogs1, rowSelLogs2], ephemeral: true });
        }

        // MÓDULO DE TICKETS (AQUI ESTÁ A CONFIGURAÇÃO DE DESTINO!)
        if (categoria === 'tickets_config') {
            let txtOpcoes = config.opcoes_ticket.length > 0 
                ? config.opcoes_ticket.map((o, idx) => `**${idx + 1}️⃣ ${o.label}** [Tipo: *${o.tipo}*]\n└ *${o.description}*`).join('\n\n') 
                : '*Nenhuma categoria configurada no momento.*';

            const embedTicket = new EmbedBuilder()
                .setTitle(`${myEmojis.suporte} Gerenciador de Atendimentos`)
                .setDescription(`Configure as opções e selecione os destinos exatos onde os chats ou tópicos vão abrir automaticamente.\n\n${txtOpcoes}`)
                .setColor('#2ed573')
                .addFields(
                    { name: '📁 Destino dos Canais de Texto (Categoria):', value: config.local_conversas_texto ? `<:#${config.local_conversas_texto}>` : '*Não definido (Abrirá solto)*', inline: false },
                    { name: '💬 Destino dos Tópicos (Canal Alvo):', value: config.local_conversas_topico ? `<#${config.local_conversas_topico}>` : '*Não definido (Dará erro se abrir Tópico)*', inline: false }
                );

            // Seletores nativos para definir os locais de abertura
            const rowDestinoTexto = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('sel_destino_categoria').setPlaceholder('Escolha a Categoria para os Canais Normais').setChannelTypes([ChannelType.GuildCategory])
            );
            const rowDestinoTopico = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('sel_destino_canal_threads').setPlaceholder('Escolha o Canal de Texto onde abrirão os Tópicos').setChannelTypes([ChannelType.GuildText])
            );

            const botoesTicket = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_ticket_opcao').setLabel('Adicionar Opção').setStyle(ButtonStyle.Primary).setEmoji(myEmojis.criar),
                new ButtonBuilder().setCustomId('limpar_ticket_opcoes').setLabel('Limpar Categorias').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.cancelar),
                new ButtonBuilder().setCustomId('enviar_painel_membros').setLabel('Publicar Painel de Suporte').setStyle(ButtonStyle.Success).setEmoji('📢')
            );

            await i.reply({ embeds: [embedTicket], components: [rowDestinoTexto, rowDestinoTopico, botoesTicket], ephemeral: true });
        }
    }

    // ==================== COLETANDO OS LOCAIS DE ABERTURA DOS TICKETS ====================
    if (i.isChannelSelectMenu()) {
        if (i.customId === 'sel_destino_categoria') {
            config.local_conversas_texto = i.values[0];
            await i.reply({ content: `✅ **Sucesso:** Os canais de texto tradicionais agora abrirão dentro da categoria selecionada!`, ephemeral: true });
        }
        if (i.customId === 'sel_destino_canal_threads') {
            config.local_conversas_topico = i.values[0];
            await i.reply({ content: `✅ **Sucesso:** Os tickets em formato de Tópico (Thread) agora abrirão dentro do canal <#${config.local_conversas_topico}>!`, ephemeral: true });
        }
        
        // Outros seletores de canais
        if (i.customId === 'sel_canais_welcome') {
            config.canal_entrada = i.values[0];
            config.canal_saida = i.values[1] || i.values[0];
            await i.reply({ content: `✅ Canais de Boas-vindas salvos com sucesso!`, ephemeral: true });
        }
        if (i.customId === 'sel_logs_principais') {
            config.logs_ticket = i.values[0];
            config.logs_mensagens = i.values[1];
            await i.reply({ content: `✅ Diretórios de logs de Tickets e Mensagens configurados!`, ephemeral: true });
        }
        if (i.customId === 'sel_logs_seguranca') {
            config.logs_punicoes = i.values[0];
            config.logs_cargos = i.values[1];
            await i.reply({ content: `✅ Diretórios de logs de Punições e Cargos configurados!`, ephemeral: true });
        }
    }

    if (i.isRoleSelectMenu()) {
        if (i.customId === 'sel_cargo_admin') {
            config.cargo_admin = i.values[0];
            await i.reply({ content: `✅ Cargo definido com sucesso para gerenciar o bot.`, ephemeral: true });
        }
        if (i.customId === 'sel_cargo_suporte') {
            config.cargo_suporte = i.values[0];
            await i.reply({ content: `✅ Cargo definido com sucesso para atender os tickets.`, ephemeral: true });
        }
    }

    // GESTÃO DE BOTÕES E MODAIS REUTILIZADOS
    if (i.isButton() && i.customId === 'btn_msg_welcome') {
        const modal = new ModalBuilder().setCustomId('modal_welcome_text').setTitle('Mensagens de Boas-Vindas');
        const inMsgEntrada = new TextInputBuilder().setCustomId('in_m_ent').setLabel('Mensagem de Entrada').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(config.msg_entrada);
        const inMsgSaida = new TextInputBuilder().setCustomId('in_m_sai').setLabel('Mensagem de Saída').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(config.msg_saida);
        modal.addComponents(new ActionRowBuilder().addComponents(inMsgEntrada), new ActionRowBuilder().addComponents(inMsgSaida));
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'modal_welcome_text') {
        config.msg_entrada = i.fields.getTextInputValue('in_m_ent');
        config.msg_saida = i.fields.getTextInputValue('in_m_sai');
        await i.reply({ content: '✅ Textos de Entrada e Saída salvos dinamicamente!', ephemeral: true });
    }

    if (i.isButton() && i.customId === 'add_ticket_opcao') {
        const modal = new ModalBuilder().setCustomId('modal_add_ticket').setTitle('Nova Opção de Atendimento');
        const nome = new TextInputBuilder().setCustomId('t_nome').setLabel('Nome da Categoria (Ex: Suporte Geral)').setStyle(TextInputStyle.Short).setRequired(true);
        const desc = new TextInputBuilder().setCustomId('t_desc').setLabel('Descrição Breve').setStyle(TextInputStyle.Short).setRequired(true);
        const tipo = new TextInputBuilder().setCustomId('t_tipo').setLabel('Escreva "TEXTO" para canal ou "TOPICO"').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('TEXTO');

        modal.addComponents(new ActionRowBuilder().addComponents(nome), new ActionRowBuilder().addComponents(desc), new ActionRowBuilder().addComponents(tipo));
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'modal_add_ticket') {
        const nomeOpcao = i.fields.getTextInputValue('t_nome');
        const descOpcao = i.fields.getTextInputValue('t_desc');
        const validacaoTipo = i.fields.getTextInputValue('t_tipo').toUpperCase() === 'TOPICO' ? 'TOPICO' : 'TEXTO';

        config.opcoes_ticket.push({
            label: nomeOpcao,
            description: descOpcao,
            value: `tkt_${nomeOpcao.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            tipo: validacaoTipo
        });
        await i.reply({ content: `✅ Categoria **"${nomeOpcao}"** registrada como tipo: **${validacaoTipo}**!`, ephemeral: true });
    }

    if (i.isButton() && i.customId === 'limpar_ticket_opcoes') {
        config.opcoes_ticket = [];
        await i.reply({ content: '🗑️ Todas as categorias foram limpas.', ephemeral: true });
    }

    if (i.isButton() && i.customId === 'enviar_painel_membros') {
        if (config.opcoes_ticket.length === 0) return i.reply({ content: '❌ Nenhuma categoria criada!', ephemeral: true });

        const embedMembros = new EmbedBuilder()
            .setTitle(`${myEmojis.suporte} Central de Suporte Oficial`)
            .setDescription('Selecione uma opção abaixo para abrir seu atendimento individualizado.')
            .setColor('#5865f2');

        const selectMembros = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('abrir_ticket_membro')
                .setPlaceholder('Escolha o assunto do ticket...')
                .addOptions(config.opcoes_ticket.map(o => ({ label: o.label, description: o.description, value: o.value })))
        );

        await i.channel.send({ embeds: [embedMembros], components: [selectMembros] });
        await i.reply({ content: '📢 Painel enviado!', ephemeral: true });
    }

    // ==================== ABERTURA UTILIZANDO OS DESTINOS DINÂMICOS ====================
    if (i.isStringSelectMenu() && i.customId === 'abrir_ticket_membro') {
        const canalExiste = i.guild.channels.cache.find(c => c.name.includes(i.user.username.toLowerCase()));
        if (canalExiste) return i.reply({ content: `${myEmojis.proibido} Você já possui um canal aberto.`, ephemeral: true });

        const opcao = config.opcoes_ticket.find(o => o.value === i.values[0]);
        const tipoCanal = opcao ? opcao.tipo : 'TEXTO';
        const nomeCategoria = opcao ? opcao.label.toLowerCase() : 'suporte';

        let canalCriado;

        if (tipoCanal === 'TEXTO') {
            const permissoesIniciais = [
                { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] }
            ];
            if (config.cargo_suporte) {
                permissoesIniciais.push({
                    id: config.cargo_suporte,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory]
                });
            }

            // SE TIVER CATEGORIA SALVA, CRIA DENTRO DELA AUTOMATICAMENTE
            canalCriado = await i.guild.channels.create({
                name: `🎫-${nomeCategoria}-${i.user.username}`,
                type: ChannelType.GuildText,
                parent: config.local_conversas_texto || null, // AQUI ABRE NA CATEGORIA CORRETA!
                permissionOverwrites: permissoesIniciais
            });
            canalCriado.setTopic(i.user.id);
        } else {
            // SE FOR TÓPICO, ENCONTRA O CANAL ALVO CONFIGURADO
            const canalAlvoTopicos = config.local_conversas_topico ? i.guild.channels.cache.get(config.local_conversas_topico) : i.channel;

            canalCriado = await canalAlvoTopicos.threads.create({
                name: `📁-${nomeCategoria}-${i.user.username}`,
                autoArchiveDuration: 1440,
                type: canalAlvoTopicos.type === ChannelType.GuildAnnouncement ? ChannelType.GuildPublicThread : ChannelType.GuildPrivateThread,
                reason: `Ticket em Tópico aberto por ${i.user.tag}`
            }).catch(async () => {
                return await canalAlvoTopicos.threads.create({
                    name: `📁-${nomeCategoria}-${i.user.username}`,
                    autoArchiveDuration: 1440,
                    type: ChannelType.GuildPublicThread,
                    reason: `Ticket público`
                });
            });

            await canalCriado.members.add(i.user.id);
            if (config.cargo_suporte) {
                const sMembers = await i.guild.members.fetch();
                sMembers.filter(m => m.roles.cache.has(config.cargo_suporte)).forEach(m => canalCriado.members.add(m.id));
            }
        }

        const embedInterno = new EmbedBuilder()
            .setTitle(`${myEmojis.suporte} Atendimento Aberto | Categoria: ${nomeCategoria.toUpperCase()}`)
            .setDescription(`Seja bem-vindo, ${i.user}!\n\nEste espaço foi reservado para o seu atendimento de forma segura. Detalhe seu problema enviando textos e mídias para que a nossa equipe possa te responder o mais rápido possível.`)
            .setColor('#2ecc71')
            .setFooter({ text: 'Zyphor Bots', iconURL: i.guild.iconURL() });

        const rowAcoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('assumir_ticket_btn').setLabel('Assumir Chamado').setStyle(ButtonStyle.Success).setEmoji(myEmojis.confirmar),
            new ButtonBuilder().setCustomId('fechar_ticket_btn').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.proibido)
        );

        await canalCriado.send({ embeds: [embedInterno], components: [rowAcoes] });
        await i.reply({ content: `✅ Seu ticket foi gerado com sucesso! Clique para acessar: ${canalCriado}`, ephemeral: true });
    }

    // BOTÕES DE AÇÕES INTERNAS DO TICKET (ASSUMIR / FECHAR)
    if (i.isButton() && i.customId === 'assumir_ticket_btn') {
        if (config.cargo_suporte && !i.member.roles.cache.has(config.cargo_suporte) && !i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({ content: `${myEmojis.proibido} Você não faz parte da equipe de suporte registrada.`, ephemeral: true });
        }

        const btnDesabilitado = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('assumir_ticket_btn').setLabel(`Atendido por ${i.user.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('fechar_ticket_btn').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.proibido)
        );

        await i.message.edit({ components: [btnDesabilitado] });
        await i.channel.send({ content: `${myEmojis.confirmar} O moderador ${i.user} vinculou-se a este chamado e iniciou o suporte.` });
        await i.reply({ content: 'Você assumiu o suporte deste ticket.', ephemeral: true });
    }

    if (i.isButton() && i.customId === 'fechar_ticket_btn') {
        if (config.cargo_suporte && !i.member.roles.cache.has(config.cargo_suporte) && !i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({ content: `${myEmojis.proibido} Apenas a equipe autorizada pode fechar chamados.`, ephemeral: true });
        }

        await i.reply({ content: `${myEmojis.cancelar} Encerrando atendimento e salvando transcrição de dados...` });

        const logsCanal = config.logs_ticket ? i.guild.channels.cache.get(config.logs_ticket) : null;
        if (logsCanal) {
            const mensagens = await i.channel.messages.fetch({ limit: 100 });
            let logsTexto = `REGISTRO DE TICKETS - CANAL: ${i.channel.name}\n\n`;
            mensagens.reverse().forEach(m => logsTexto += `[${m.createdAt.toLocaleString('pt-BR')}] ${m.author.tag}: ${m.content}\n`);

            const arquivo = new AttachmentBuilder(Buffer.from(logsTexto, 'utf-8'), { name: `transcricao-${i.channel.name}.txt` });
            const embedLogFinal = new EmbedBuilder()
                .setTitle('📁 Atendimento Arquivado')
                .addFields(
                    { name: 'Canal:', value: `\`${i.channel.name}\``, inline: true },
                    { name: 'Encerramento por:', value: `${i.user}`, inline: true }
                )
                .setColor('#ff4757').setTimestamp();

            await logsCanal.send({ embeds: [embedLogFinal], files: [arquivo] });
        }

        setTimeout(() => i.channel.delete().catch(() => {}), 3000);
    }
});

client.login(process.env.DISCORD_TOKEN);

