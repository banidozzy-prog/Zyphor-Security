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

// Banco de dados dinâmico por Servidor (Em produção, use um banco real como MongoDB ou Quick.db)
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
            local_conversas_texto: null, 
            local_conversas_topico: null, 
            opcoes_ticket: [] 
        });
    }
    return db.get(guildId);
}

// Seus Emojis Personalizados ativos
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
        console.log('🚀 Sistema Completo e Corrigido Online!');
    } catch (error) { console.error(error); }
});

// ==================== MONITORAMENTO DE RESPOSTAS (NOTIFICAÇÃO) ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const config = getGuildConfig(message.guild.id);

    // Se quem digitou possui o cargo de suporte, o bot assume que é uma resposta ao ticket
    if (config.cargo_suporte && message.member?.roles.cache.has(config.cargo_suporte)) {
        let userIdTicket = null;

        // Se for um canal de texto normal, pegamos o ID salvo no Tópico do Canal
        if (message.channel.type === ChannelType.GuildText && message.channel.topic) {
            userIdTicket = message.channel.topic;
        } 
        // Se for uma Thread (Tópico), buscamos nos registros se o nome termina com o ID ou se foi salvo
        else if (message.channel.isThread()) {
            // Buscamos o criador do ticket pelo histórico ou metadados da thread
            const owner = await message.channel.fetchOwner();
            if (owner && owner.id !== client.user.id) userIdTicket = owner.id;
        }

        if (userIdTicket) {
            // Evita floodar a notificação se o suporte mandar várias mensagens seguidas
            const ultimasMsg = await message.channel.messages.fetch({ limit: 2 });
            const msgAnterior = ultimasMsg.toJSON()[1];
            if (msgAnterior && msgAnterior.author.id === message.author.id) return; 

            const membro = await message.guild.members.fetch(userIdTicket).catch(() => null);
            if (membro) {
                // 1. Marcar o cara no chat do ticket
                await message.channel.send(`🔔 ${membro}, um atendente da nossa equipe respondeu no seu ticket!`);
                
                // 2. Mandar notificação na DM do membro
                await membro.send(`🎫 **Nova Resposta!** A equipe de suporte respondeu ao seu ticket no servidor **${message.guild.name}**.\n👉 Acesse o chat aqui: ${message.channel}`)
                    .catch(() => console.log(`A DM de ${membro.user.tag} está fechada.`));
            }
        }
    }
});

// ==================== PAINEL ADMINISTRATIVO INTERATIVO ====================
client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = getGuildConfig(i.guild.id);

    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator) && (config.cargo_admin && !i.member.roles.cache.has(config.cargo_admin))) {
            return i.reply({ content: `${myEmojis.proibido} Sem permissão administrativa.`, ephemeral: true });
        }

        const embedPrincipal = new EmbedBuilder()
            .setTitle(`${myEmojis.codigo} Central de Gerenciamento`)
            .setDescription('Configure os módulos do seu bot usando os seletores nativos abaixo.')
            .setColor('#4f46e5');

        const menuMestre = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('menu_mestre_config')
                .setPlaceholder('Escolha o módulo...')
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

        if (categoria === 'mod_config') {
            const embedMod = new EmbedBuilder()
                .setTitle('🛡️ Moderação & Boas-Vindas')
                .setColor('#ff4757')
                .addFields(
                    { name: '👤 Cargo Admin:', value: config.cargo_admin ? `<@&${config.cargo_admin}>` : '*Não definido*', inline: true },
                    { name: '🎫 Cargo Suporte:', value: config.cargo_suporte ? `<@&${config.cargo_suporte}>` : '*Não definido*', inline: true },
                    { name: '🚪 Canais:', value: `**Entrada:** ${config.canal_entrada ? `<#${config.canal_entrada}>` : '*Não definido*'}\n**Saída:** ${config.canal_saida ? `<#${config.canal_saida}>` : '*Não definido*'}`, inline: false }
                );

            const rowCargos = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('sel_cargo_admin').setPlaceholder('Cargo Admin (Comandos)'));
            const rowSuporte = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('sel_cargo_suporte').setPlaceholder('Cargo Suporte (Tickets)'));
            const rowCanais = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('sel_canais_welcome').setPlaceholder('Canais de Boas-Vindas').setMinValues(1).setMaxValues(2).setChannelTypes([ChannelType.GuildText]));
            const rowTextoBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_msg_welcome').setLabel('Editar Mensagens de Texto').setStyle(ButtonStyle.Primary).setEmoji('📝'));

            await i.reply({ embeds: [embedMod], components: [rowCargos, rowSuporte, rowCanais, rowTextoBtn], ephemeral: true });
        }

        if (categoria === 'logs_config') {
            const embedLogs = new EmbedBuilder()
                .setTitle('📋 Configuração do Sistema de Logs')
                .setColor('#ffa502')
                .addFields(
                    { name: '🎫 Logs de Tickets:', value: config.logs_ticket ? `<#${config.logs_ticket}>` : '*Não definido*', inline: true },
                    { name: '💬 Logs de Mensagens:', value: config.logs_mensagens ? `<#${config.logs_mensagens}>` : '*Não definido*', inline: true },
                    { name: '🔨 Logs de Punições:', value: config.logs_punicoes ? `<#${config.logs_punicoes}>` : '*Não definido*', inline: true },
                    { name: '👑 Logs de Cargos:', value: config.logs_cargos ? `<#${config.logs_cargos}>` : '*Não definido*', inline: true }
                );

            const rowSelLogs1 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('sel_logs_principais').setPlaceholder('Definir Logs de Tickets e Mensagens').setMinValues(2).setMaxValues(2).setChannelTypes([ChannelType.GuildText]));
            const rowSelLogs2 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('sel_logs_seguranca').setPlaceholder('Definir Logs de Punições e Cargos').setMinValues(2).setMaxValues(2).setChannelTypes([ChannelType.GuildText]));

            await i.reply({ embeds: [embedLogs], components: [rowSelLogs1, rowSelLogs2], ephemeral: true });
        }

        if (categoria === 'tickets_config') {
            let txtOpcoes = config.opcoes_ticket.length > 0 
                ? config.opcoes_ticket.map((o, idx) => `**${idx + 1}️⃣ ${o.label}** [${o.tipo}]\n└ *${o.description}*`).join('\n\n') 
                : '*Nenhuma categoria criada.*';

            const embedTicket = new EmbedBuilder()
                .setTitle(`${myEmojis.suporte} Gerenciador de Tickets`)
                .setDescription(txtOpcoes)
                .setColor('#2ed573')
                .addFields(
                    { name: '📁 Categoria dos Canais:', value: config.local_conversas_texto ? `<#${config.local_conversas_texto}>` : '*Não definido*', inline: true },
                    { name: '💬 Canal dos Tópicos:', value: config.local_conversas_topico ? `<#${config.local_conversas_topico}>` : '*Não definido*', inline: true }
                );

            const rowDestinoTexto = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('sel_destino_categoria').setPlaceholder('Categoria para Canais de Texto').setChannelTypes([ChannelType.GuildCategory]));
            const rowDestinoTopico = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('sel_destino_canal_threads').setPlaceholder('Canal de Texto para os Tópicos').setChannelTypes([ChannelType.GuildText]));
            const botoesTicket = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_ticket_opcao').setLabel('Adicionar Opção').setStyle(ButtonStyle.Primary).setEmoji(myEmojis.criar),
                new ButtonBuilder().setCustomId('limpar_ticket_opcoes').setLabel('Limpar Categorias').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.cancelar),
                new ButtonBuilder().setCustomId('enviar_painel_membros').setLabel('Publicar Painel').setStyle(ButtonStyle.Success).setEmoji('📢')
            );

            await i.reply({ embeds: [embedTicket], components: [rowDestinoTexto, rowDestinoTopico, botoesTicket], ephemeral: true });
        }
    }

    // ==================== SALVAMENTO DOS SELETORES ====================
    if (i.isChannelSelectMenu()) {
        if (i.customId === 'sel_destino_categoria') config.local_conversas_texto = i.values[0];
        if (i.customId === 'sel_destino_canal_threads') config.local_conversas_topico = i.values[0];
        if (i.customId === 'sel_canais_welcome') { config.canal_entrada = i.values[0]; config.canal_saida = i.values[1] || i.values[0]; }
        if (i.customId === 'sel_logs_principais') { config.logs_ticket = i.values[0]; config.logs_mensagens = i.values[1]; }
        if (i.customId === 'sel_logs_seguranca') { config.logs_punicoes = i.values[0]; config.logs_cargos = i.values[1]; }
        await i.reply({ content: '✅ Alterações de canais aplicadas com sucesso!', ephemeral: true });
    }

    if (i.isRoleSelectMenu()) {
        if (i.customId === 'sel_cargo_admin') config.cargo_admin = i.values[0];
        if (i.customId === 'sel_cargo_suporte') config.cargo_suporte = i.values[0];
        await i.reply({ content: '✅ Cargos atualizados com sucesso!', ephemeral: true });
    }

    // Modais e criação de opções
    if (i.isButton() && i.customId === 'btn_msg_welcome') {
        const modal = new ModalBuilder().setCustomId('modal_welcome_text').setTitle('Textos de Boas-Vindas');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_m_ent').setLabel('Entrada').setStyle(TextInputStyle.Paragraph).setValue(config.msg_entrada)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_m_sai').setLabel('Saída').setStyle(TextInputStyle.Paragraph).setValue(config.msg_saida))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'modal_welcome_text') {
        config.msg_entrada = i.fields.getTextInputValue('in_m_ent');
        config.msg_saida = i.fields.getTextInputValue('in_m_sai');
        await i.reply({ content: '✅ Textos salvos!', ephemeral: true });
    }

    if (i.isButton() && i.customId === 'add_ticket_opcao') {
        const modal = new ModalBuilder().setCustomId('modal_add_ticket').setTitle('Nova Categoria');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_nome').setLabel('Nome').setStyle(TextInputStyle.Short)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_desc').setLabel('Descrição').setStyle(TextInputStyle.Short)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_tipo').setLabel('"TEXTO" ou "TOPICO"').setStyle(TextInputStyle.Short).setPlaceholder('TEXTO'))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'modal_add_ticket') {
        const nome = i.fields.getTextInputValue('t_nome');
        const desc = i.fields.getTextInputValue('t_desc');
        const tipo = i.fields.getTextInputValue('t_tipo').toUpperCase() === 'TOPICO' ? 'TOPICO' : 'TEXTO';
        config.opcoes_ticket.push({ label: nome, description: desc, value: `tkt_${Date.now()}`, tipo });
        await i.reply({ content: '✅ Opção adicionada!', ephemeral: true });
    }

    if (i.isButton() && i.customId === 'limpar_ticket_opcoes') {
        config.opcoes_ticket = [];
        await i.reply({ content: '🗑️ Opções limpas!', ephemeral: true });
    }

    if (i.isButton() && i.customId === 'enviar_painel_membros') {
        if (config.opcoes_ticket.length === 0) return i.reply({ content: '❌ Crie opções primeiro!', ephemeral: true });
        const embed = new EmbedBuilder().setTitle(`${myEmojis.suporte} Central de Atendimento`).setDescription('Abra um ticket selecionando abaixo:').setColor('#5865f2');
        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('abrir_ticket_membro').setPlaceholder('Selecione o assunto...').addOptions(config.opcoes_ticket.map(o => ({ label: o.label, description: o.description, value: o.value }))));
        await i.channel.send({ embeds: [embed], components: [menu] });
        await i.reply({ content: '📢 Painel enviado!', ephemeral: true });
    }

    // ==================== PROCESSAMENTO DE ABERTURA DE TICKET ====================
    if (i.isStringSelectMenu() && i.customId === 'abrir_ticket_membro') {
        const opcao = config.opcoes_ticket.find(o => o.value === i.values[0]);
        if (!opcao) return i.reply({ content: 'Erro ao processar categoria.', ephemeral: true });

        let canalCriado;

        if (opcao.tipo === 'TEXTO') {
            const overwrites = [
                { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] }
            ];
            if (config.cargo_suporte) overwrites.push({ id: config.cargo_suporte, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

            canalCriado = await i.guild.channels.create({
                name: `🎫-${opcao.label.toLowerCase()}-${i.user.username}`,
                type: ChannelType.GuildText,
                parent: config.local_conversas_texto || null,
                permissionOverwrites: overwrites
            });
            canalCriado.setTopic(i.user.id); // Salva o ID do dono no tópico do canal de texto
        } else {
            const canalAlvo = config.local_conversas_topico ? i.guild.channels.cache.get(config.local_conversas_topico) : i.channel;
            
            canalCriado = await canalAlvo.threads.create({
                name: `📁-${opcao.label.toLowerCase()}-${i.user.username}`,
                autoArchiveDuration: 1440,
                type: canalAlvo.type === ChannelType.GuildAnnouncement ? ChannelType.GuildPublicThread : ChannelType.GuildPrivateThread
            });
            await canalCriado.members.add(i.user.id);
        }

        const embedInterno = new EmbedBuilder()
            .setTitle(`${myEmojis.suporte} Suporte Iniciado`)
            .setDescription(`Olá ${i.user}, envie todos os detalhes do seu problema abaixo para nossa equipe.`)
            .setColor('#2ecc71');

        const rowAcoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('assumir_ticket_btn').setLabel('Assumir Chamado').setStyle(ButtonStyle.Success).setEmoji(myEmojis.confirmar),
            new ButtonBuilder().setCustomId('fechar_ticket_btn').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.proibido)
        );

        // MARCA O CARA E O CARGO DE SUPORTE LOGO NA ENTRADA
        const mencaoSuporte = config.cargo_suporte ? `<@&${config.cargo_suporte}>` : '';
        await canalCriado.send({ content: `${i.user} ${mencaoSuporte}`, embeds: [embedInterno], components: [rowAcoes] });
        await i.reply({ content: `✅ Seu ticket foi aberto em: ${canalCriado}`, ephemeral: true });
    }

    // ASSUMIR TICKET
    if (i.isButton() && i.customId === 'assumir_ticket_btn') {
        if (config.cargo_suporte && !i.member.roles.cache.has(config.cargo_suporte)) return i.reply({ content: 'Apenas a equipe de suporte!', ephemeral: true });
        
        const desabilitado = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('assumir_ticket_btn').setLabel(`Atendido por ${i.user.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('fechar_ticket_btn').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.proibido)
        );
        await i.message.edit({ components: [desabilitado] });
        await i.channel.send({ content: `${myEmojis.confirmar} O suporte foi assumido por ${i.user}.` });
        await i.reply({ content: 'Você assumiu este ticket.', ephemeral: true });
    }

    // FECHAR TICKET (MARCANDO A PESSOA NAS LOGS)
    if (i.isButton() && i.customId === 'fechar_ticket_btn') {
        if (config.cargo_suporte && !i.member.roles.cache.has(config.cargo_suporte)) return i.reply({ content: 'Apenas suporte!', ephemeral: true });

        await i.reply({ content: 'Fechando o ticket...' });
        const logsCanal = config.logs_ticket ? i.guild.channels.cache.get(config.logs_ticket) : null;

        if (logsCanal) {
            const mensagens = await i.channel.messages.fetch({ limit: 50 });
            let txt = `HISTÓRICO DO TICKET: ${i.channel.name}\n\n`;
            mensagens.reverse().forEach(m => txt += `[${m.createdAt.toLocaleTimeString()}] ${m.author.tag}: ${m.content}\n`);

            // Descobre quem era o dono para marcar na log
            let donoId = i.channel.topic;
            if (!donoId && i.channel.isThread()) {
         const owner = await i.channel.fetchOwner();
                if (owner) donoId = owner.id;
            }
            const arquivo = new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: 'logs.txt' });
            const embed = new EmbedBuilder()
                .setTitle('📁 Ticket Encerrado')
                .setColor('#ff4757')
                .addFields(
                    { name: '👤 Dono do Ticket:', value: donoId ? `<@${donoId}>` : '*Não localizado*', inline: true }, // MARCA O CARA NA LOG
                    { name: '🔒 Fechado por:', value: `${i.user}`, inline: true }
                );

            await logsCanal.send({ embeds: [embed], files: [arquivo] });
        }
        setTimeout(() => i.channel.delete().catch(() => {}), 2000);
    }
});
// ==================== EVENTOS DE LOGS ADICIONAIS FIXADOS ====================
client.on('messageDelete', async (m) => {
    if (!m.guild || m.author?.bot) return;
    const canal = m.guild.channels.cache.get(getGuildConfig(m.guild.id).logs_mensagens);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setTitle(`${myEmojis.cancelar} Mensagem Apagada`)
        .setDescription(`**Autor:** ${m.author}\n**Canal:** ${m.channel}`)
        .addFields({ name: 'Conteúdo:', value: m.content || '*Sem texto (Mídia)*' })
        .setColor('#ff4757').setTimestamp();
    canal.send({ embeds: [embed] });
});

client.on('messageUpdate', async (antiga, nova) => {
    if (!antiga.guild || antiga.author?.bot || antiga.content === nova.content) return;
    const canal = antiga.guild.channels.cache.get(getGuildConfig(antiga.guild.id).logs_mensagens);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setTitle('📝 Mensagem Editada')
        .setDescription(`**Autor:** ${antiga.author}\n**Canal:** ${antiga.channel}`)
        .addFields({ name: 'Antes:', value: antiga.content || '*Vazio*' }, { name: 'Depois:', value: nova.content || '*Vazio*' })
        .setColor('#ffa502').setTimestamp();
    canal.send({ embeds: [embed] });
});

client.on('guildBanAdd', async (ban) => {
    const canal = ban.guild.channels.cache.get(getGuildConfig(ban.guild.id).logs_punicoes);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setTitle(`${myEmojis.proibido} Membro Banido`)
        .setDescription(`**Usuário:** ${ban.user} (${ban.user.tag})\n**Motivo:** ${ban.reason || 'Não informado.'}`)
        .setColor('#ff4757').setTimestamp();
    canal.send({ embeds: [embed] });
});

client.on('guildMemberUpdate', async (antigo, novo) => {
    const canal = novo.guild.channels.cache.get(getGuildConfig(novo.guild.id).logs_cargos);
    if (!canal) return;

    // Detectar alteração de cargos
    const adicionados = novo.roles.cache.filter(r => !antigo.roles.cache.has(r.id));
    const removidos = antigo.roles.cache.filter(r => !novo.roles.cache.has(r.id));

    if (adicionados.size > 0 || removidos.size > 0) {
        const embed = new EmbedBuilder()
            .setTitle('👑 Cargos Atualizados')
            .setDescription(`**Membro:** ${novo.user}`)
            .setColor('#2ed573').setTimestamp();

        if (adicionados.size > 0) embed.addFields({ name: '➕ Cargos Adicionados:', value: adicionados.map(r => `${r}`).join(', ') });
        if (removidos.size > 0) embed.addFields({ name: '➖ Cargos Removidos:', value: removidos.map(r => `${r}`).join(', ') });

        canal.send({ embeds: [embed] });
    }
});
// Entrada e Saída normais
client.on('guildMemberAdd', async (m) => {
    const conf = getGuildConfig(m.guild.id);
    const c = m.guild.channels.cache.get(conf.canal_entrada);
    if (c) c.send({ content: conf.msg_entrada.replace('{membro}', `${m.user}`) });
});
client.on('guildMemberRemove', async (m) => {
    const conf = getGuildConfig(m.guild.id);
    const c = m.guild.channels.cache.get(conf.canal_saida);
    if (c) c.send({ content: conf.msg_saida.replace('{membro}', `${m.user.tag}`) });
});
client.login(process.env.DISCORD_TOKEN);
