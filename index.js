const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const FILE_PATH = './config-zyphor.json';
const SEU_ID = '1460149186577174680'; // Seu ID Master de Desenvolvedor

// Banco de dados limpo - Inicia com o filtro de chat zerado para você configurar
let db = {
    canal_entrada: 'Não definido',
    canal_saida: 'Não definido',
    canal_mensagens: 'Não definido',
    canal_voz: 'Não definido',
    canal_punicoes: 'Não definido',
    palavras_proibidas: [], // Fica vazio para você preencher pelo Discord
    termos_raid: ['org', 'lideranca', 'apgratis', 'gratis', 'vagas', 'recrutamento', 'ap-grátis', 'adm'] // Proteção pesada de Ban Global
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

function obterIdCanal(mencao) {
    if (!mencao || mencao === 'Não definido') return null;
    return mencao.replace(/[<#>]/g, '');
}

function checarPalavraProibida(texto) {
    if (!texto) return false;
    const textoLimpo = texto.toLowerCase().replace(/\s+/g, '');
    return db.palavras_proibidas.some(termo => textoLimpo.includes(termo.toLowerCase()));
}

function checarTermoRaid(texto) {
    if (!texto) return false;
    const textoLimpo = texto.toLowerCase().replace(/\s+/g, '');
    return db.termos_raid.some(termo => textoLimpo.includes(termo.toLowerCase()));
}

// 🛡️ SISTEMA DE BANIMENTO GLOBAL COM DETALHES DE LOG (FOTO + LINK)
async function aplicarBanimentoGlobal(user, guildOrigem, motivo) {
    console.log(`[BAN GLOBAL] Aplicando punição ao ID: ${user.id}`);
    
    let linkConvite = 'Não foi possível gerar o link';
    try {
        const canalTexto = guildOrigem.channels.cache.find(c => c.type === 0);
        if (canalTexto) {
            const convite = await canalTexto.createInvite({ maxAge: 0, maxUses: 0 });
            linkConvite = convite.url;
        }
    } catch(e) {}

    // Envia o Log Completo com a FOTO e LINK na sala configurada para Bans
    const idCanalBans = obterIdCanal(db.canal_punicoes);
    if (idCanalBans) {
        const canalLog = client.channels.cache.get(idCanalBans);
        if (canalLog) {
            const embedBan = new EmbedBuilder()
                .setTitle('<:martelo:1503163618273792050> Usuário Banido Globalmente!')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setDescription(
                    `👤 **Usuário:** ${user.tag} (<@${user.id}>)\n` +
                    `🆔 **ID:** \`${user.id}\`\n` +
                    `<:alerta:1501991676628041859> **Motivo:** ${motivo}\n\n` +
                    `🏠 **Servidor de Origem:** ${guildOrigem.name}\n` +
                    `🔗 **Link do Servidor:** [Clique para entrar](${linkConvite})`
                )
                .setColor('#ff0000')
                .setTimestamp();
            
            try { await canalLog.send({ embeds: [embedBan] }); } catch(e) {}
        }
    }

    for (const guild of client.guilds.cache.values()) {
        try { 
            await guild.members.ban(user.id, { reason: `Zyphor Anti-Raid: ${motivo} (Origem: ${guildOrigem.name})` }); 
        } catch (error) {
            continue;
        }
    }
}

// 🛡️ MONITORAMENTO DO CHAT (MENSAGENS PROIBIDAS)
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const idCanalMensagens = obterIdCanal(db.canal_mensagens);

    if (checarPalavraProibida(message.content)) {
        try {
            await message.delete();
            const aviso = await message.channel.send(`<:erro:1508472500495974600> ${message.author}, você enviou um termo proibido pelo sistema de segurança.`);
            setTimeout(() => aviso.delete().catch(() => {}), 3000);

            // Manda o Log com foto para o canal "Mensagem" definido no /configurar
            if (idCanalMensagens) {
                const canalLogMsg = client.channels.cache.get(idCanalMensagens);
                if (canalLogMsg) {
                    const embedLogMsg = new EmbedBuilder()
                        .setTitle('📝 Mensagem Proibida Apagada')
                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                        .setDescription(`👤 **Autor:** ${message.author.tag} (<@${message.author.id}>)\n🆔 **ID:** \`${message.author.id}\`\n💬 **Conteúdo:** \`${message.content}\`\n📍 **Canal:** <#${message.channel.id}>`)
                        .setColor('#ffaa00');
                    await canalLogMsg.send({ embeds: [embedLogMsg] });
                }
            }
        } catch (e) {}
    }
});

// 🛡️ MONITORAMENTO DE ENTRADA E VOZ (ANTI-RAID BANS)
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;
    const nomeCompleto = `${member.user.username} ${member.displayName}`;
    if (checarTermoRaid(nomeCompleto)) {
        await aplicarBanimentoGlobal(member.user, member.guild, 'Nome/Assinatura de Raid detectada na entrada.');
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!oldState.channelId && newState.channelId) {
        const member = newState.member;
        if (!member || member.user.bot) return;

        const dadosCall = `${member.user.username} ${member.displayName} ${member.nickname || ''}`;
        if (checarTermoRaid(dadosCall)) {
            await aplicarBanimentoGlobal(member.user, newState.guild, 'Tentativa de Raid por Filtro de Call de Voz.');
        }
    }
});

// 🛠️ PROCESSAMENTO DOS COMANDOS SLASH
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'configurar') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: `<:erro:1508472500495974600> Sem permissão.`, ephemeral: true });
        }

        const embedOriginal = new EmbedBuilder()
            .setTitle('Zyphor BOTS ⚙️')
            .setDescription(
                `🛠️ **Informações sobre o sistema:**\n` +
                `<:status:1503163485264285776> **Status:** Ativado\n\n` +
                `**Canais definidos:**\n` +
                `<:documento:1507816962062029002> **Entrada:** ${db.canal_entrada}\n` +
                `<:documento:1507816962062029002> **Saída:** ${db.canal_saida}\n` +
                `<:mgs:1503163398395920464> **Mensagem (Log/Filtro Chat):** ${db.canal_mensagens}\n` +
                `<:monitoramento:1503163485264285776> **Voz (Filtro Call):** ${db.canal_voz}\n` +
                `<:martelo:1503163618273792050> **Bans (Log Global):** ${db.canal_punicoes}\n\n` +
                `🍃 Em caso de **dúvidas** ou **bugs**, não hesite em entrar em meu **[servidor de suporte](https://discord.gg/Guw9zJE9nP)** para que nossa equipe possa lhe ajudar.`
            )
            .setColor('#2b2d31');

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('menu-config-dinamico')
                .setPlaceholder('Selecione para definir este canal atual no sistema.')
                .addOptions([
                    { label: 'Definir como canal de Entrada', value: 'set_entrada' },
                    { label: 'Definir como canal de Saída', value: 'set_saida' },
                    { label: 'Definir como canal de Mensagem', value: 'set_mensagens' },
                    { label: 'Definir como canal de Voz', value: 'set_voz' },
                    { label: 'Definir como canal de Punições (Bans)', value: 'set_bans' }
                ])
        );

        return interaction.reply({ embeds: [embedOriginal], components: [menu] });
    }

    // ➕ ADICIONAR PALAVRAS (SEPARADAS POR VÍRGULA)
    if (commandName === 'addpalavra') {
        if (!interaction.member.permissions.has('ManageMessages')) {
            return interaction.reply({ content: `<:erro:1508472500495974600> Sem permissão.`, ephemeral: true });
        }
        
        const entrada = interaction.options.getString('palavra');
        const palavrasNovas = entrada.split(',').map(p => p.trim().toLowerCase()).filter(p => p.length > 0);
        
        let adicionadas = [];
        let jaExistiam = [];

        palavrasNovas.forEach(novaPalavra => {
            if (db.palavras_proibidas.includes(novaPalavra)) {
                jaExistiam.push(novaPalavra);
            } else {
                db.palavras_proibidas.push(novaPalavra);
                adicionadas.push(novaPalavra);
            }
        });

        if (adicionadas.length > 0) salvarDados();

        let resposta = '';
        if (adicionadas.length > 0) resposta += `✅ **Adicionadas ao filtro:** ${adicionadas.map(p => `\`${p}\``).join(', ')}\n`;
        if (jaExistiam.length > 0) resposta += `⚠️ **Já estavam na lista:** ${jaExistiam.map(p => `\`${p}\``).join(', ')}`;

        return interaction.reply({ content: resposta, ephemeral: true });
    }

    // 🗑️ REMOVER PALAVRAS (SEPARADAS POR VÍRGULA)
    if (commandName === 'rempalavra') {
        if (!interaction.member.permissions.has('ManageMessages')) {
            return interaction.reply({ content: `<:erro:1508472500495974600> Sem permissão.`, ephemeral: true });
        }
        
        const entrada = interaction.options.getString('palavra');
        const palavrasRemover = entrada.split(',').map(p => p.trim().toLowerCase()).filter(p => p.length > 0);
        
        let removidas = [];
        let naoEncontradas = [];

        palavrasRemover.forEach(palavra => {
            const index = db.palavras_proibidas.indexOf(palavra);
            if (index !== -1) {
                db.palavras_proibidas.splice(index, 1);
                removidas.push(palavra);
            } else {
                naoEncontradas.push(palavra);
            }
        });

        if (removidas.length > 0) salvarDados();

        let resposta = '';
        if (removidas.length > 0) resposta += `🗑️ **Removidas do filtro:** ${removidas.map(p => `\`${p}\``).join(', ')}\n`;
        if (naoEncontradas.length > 0) resposta += `❌ **Não encontradas na lista:** ${naoEncontradas.map(p => `\`${p}\``).join(', ')}`;

        return interaction.reply({ content: resposta, ephemeral: true });
    }

    if (commandName === 'palavras') {
        const listaFormatada = db.palavras_proibidas.map(p => `\`${p}\``).join(', ');
        return interaction.reply({ content: `📝 **Filtros de Chat ativos atualmente:**\n${listaFormatada || 'Nenhum termo cadastrado.'}`, ephemeral: true });
    }

    // 👑 COMANDOS DE SUPER ADMIN MASTER
    if (commandName === 'servidores') {
        if (interaction.user.id !== SEU_ID) return interaction.reply({ content: `❌ Negado.`, ephemeral: true });

        await interaction.deferReply({ ephemeral: true });
        let textoServidores = `📊 **Estou atualmente in \`${client.guilds.cache.size}\` servidores:**\n\n`;

        for (const guild of client.guilds.cache.values()) {
            let link = 'Sem permissão';
            try {
                const canal = guild.channels.cache.find(c => c.type === 0);
                if (canal) {
                    const inv = await canal.createInvite({ maxAge: 0, maxUses: 0 });
                    link = `[Entrar](${inv.url})`;
                }
            } catch(e) {}
            textoServidores += `🔹 **${guild.name}** \`(${guild.id})\` - Conexão: ${link}\n`;
        }
        return interaction.editReply({ content: textoServidores });
    }

    if (commandName === 'sair') {
        if (interaction.user.id !== SEU_ID) return interaction.reply({ content: `❌ Negado.`, ephemeral: true });

        const idAlvo = interaction.options.getString('id');
        const guildAlvo = client.guilds.cache.get(idAlvo);

        if (!guildAlvo) return interaction.reply({ content: `❌ Servidor não encontrado.`, ephemeral: true });

        try {
            await guildAlvo.leave();
            return interaction.reply({ content: `🚪 Saí com sucesso de **${guildAlvo.name}** \`(${idAlvo})\`.`, ephemeral: true });
        } catch(err) {
            return interaction.reply({ content: `❌ Erro ao sair do servidor.`, ephemeral: true });
        }
    }

    if (commandName === 'ping') {
        return interaction.reply({ content: `<:sino:1507817911392407552> **Pong!** \`${Math.round(client.ws.ping)}ms\``, ephemeral: true });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'menu-config-dinamico') {
        if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'Sem permissão.', ephemeral: true });

        const salaAtual = interaction.channel.toString();
        const escolha = interaction.values[0];

        if (escolha === 'set_entrada') db.canal_entrada = salaAtual;
        if (escolha === 'set_saida') db.canal_saida = salaAtual;
        if (escolha === 'set_mensagens') db.canal_mensagens = salaAtual;
        if (escolha === 'set_voz') db.canal_voz = salaAtual;
        if (escolha === 'set_bans') db.canal_punicoes = salaAtual;

        salvarDados();
        return interaction.reply({ content: `✅ Configuração salva!`, ephemeral: true });
    }
});

client.on('ready', async () => {
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);
    console.log(`[ONLINE] Zyphor Sistema Master V3 Limpo.`);
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);

    const comandos = [
        new SlashCommandBuilder().setName('configurar').setDescription('⚙️ Painel de configuração de canais.'),
        new SlashCommandBuilder().setName('palavras').setDescription('📝 Lista de filtros do chat comum.'),
        new SlashCommandBuilder().setName('addpalavra').setDescription('➕ Bloquear palavras separadas por vírgula.').addStringOption(o => o.setName('palavra').setDescription('Ex: termo1, termo2').setRequired(true)),
        new SlashCommandBuilder().setName('rempalavra').setDescription('🗑️ Remover palavras separadas por vírgula.').addStringOption(o => o.setName('palavra').setDescription('Ex: termo1, termo2').setRequired(true)),
        new SlashCommandBuilder().setName('ping').setDescription('🏓 Latência.'),
        new SlashCommandBuilder().setName('servidores').setDescription('👑 [DONO] Lista de servidores em que o bot está.'),
        new SlashCommandBuilder().setName('sair').setDescription('🚪 [DONO] Força a saída do bot de uma guilda pelo ID.').addStringOption(o => o.setName('id').setDescription('ID do servidor').setRequired(true))
    ].map(cmd => cmd.toJSON());

    try {
        await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: comandos });
    } catch (e) {}
});

if (TOKEN) client.login(TOKEN);

