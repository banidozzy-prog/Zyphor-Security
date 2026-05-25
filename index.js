const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const http = require('http');

const TOKEN = process.env.DISCORD_TOKEN;
const FILE_PATH = './config-zyphor.json';
const SEU_ID = '1460149186577174680'; // Seu ID Master

// 🌐 MINI SERVIDOR WEB PARA RECONECTAR E NÃO DEIXAR A RAILWAY DESLIGAR O BOT
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Zyphor Master V3 está online e protegido!');
}).listen(process.env.PORT || 3000, () => {
    console.log('[WEB] Servidor de estabilidade ativo na Railway.');
});

let db = {
    status_entrada: true,
    status_voz: true,
    canal_entrada: 'Não definido',
    canal_saida: 'Não definido',
    canal_mensagens: 'Não definido',
    canal_voz: 'Não definido',
    canal_punicoes: 'Não definido',
    palavras_proibidas: [],
    termos_raid: ['org', 'lideranca', 'apgratis', 'gratis', 'vagas', 'recrutamento', 'ap-grátis', 'adm']
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

// 🛡️ ENVIAR EMBED DE LOG COM FOTO E LINK DO SERVIDOR
async function aplicarBanimentoGlobal(user, guildOrigem, motivo) {
    console.log(`[BAN GLOBAL] ID: ${user.id}`);
    
    let linkConvite = 'Não foi possível gerar o link';
    try {
        const canalTexto = guildOrigem.channels.cache.find(c => c.type === 0);
        if (canalTexto) {
            const convite = await canalTexto.createInvite({ maxAge: 0, maxUses: 0 });
            linkConvite = convite.url;
        }
    } catch(e) {}

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
        try { await guild.members.ban(user.id, { reason: `Zyphor Anti-Raid: ${motivo}` }); } catch (error) {}
    }
}

// 🛡️ MONITORAMENTO DO CHAT
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    if (checarPalavraProibida(message.content)) {
        try {
            await message.delete();
            const aviso = await message.channel.send(`<:erro:1508472500495974600> ${message.author}, você enviou um termo proibido pelo sistema de segurança.`);
            setTimeout(() => aviso.delete().catch(() => {}), 3000);

            const idCanalMensagens = obterIdCanal(db.canal_mensagens);
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

// 🛡️ MONITORAMENTO DE ENTRADA (ANTI-RAID)
client.on('guildMemberAdd', async (member) => {
    if (!db.status_entrada || member.user.bot) return;
    const nomeCompleto = `${member.user.username} ${member.displayName}`;
    if (checarTermoRaid(nomeCompleto)) {
        await aplicarBanimentoGlobal(member.user, member.guild, 'Nome/Assinatura de Raid na entrada.');
    }
});

// 🛡️ MONITORAMENTO DE VOZ (CALLS)
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!db.status_voz) return;
    if (!oldState.channelId && newState.channelId) {
        const member = newState.member;
        if (!member || member.user.bot) return;

        const dadosCall = `${member.user.username} ${member.displayName} ${member.nickname || ''}`;
        if (checarTermoRaid(dadosCall)) {
            await aplicarBanimentoGlobal(member.user, newState.guild, 'Assinatura de Raid em Call de Voz.');
        }
    }
});

// FUNÇÃO PARA GERAR O PAINEL AVANÇADO IGUAL AO SEU PRINT
function gerarPainelEmbed() {
    return new EmbedBuilder()
        .setTitle('Zyphor BOTS ⚙️')
        .setDescription(
            `⚙️ **Informações sobre o sistema:**\n` +
            `<:status:1503163485264285776> **Status:** Ativado\n\n` +
            `⚙️ **Painel de Proteção:**\n` +
            `${db.status_entrada ? '🟢' : '🔴'} **Anti-Raid Entrada:** ${db.status_entrada ? 'ATIVADO' : 'DESATIVADO'}\n` +
            `${db.status_voz ? '🟢' : '🔴'} **Filtro de Voz (Call):** ${db.status_voz ? 'ATIVADO' : 'DESATIVADO'}\n\n` +
            `**Canais definidos:**\n` +
            `<:documento:1507816962062029002> **Entrada:** ${db.canal_entrada}\n` +
            `<:documento:1507816962062029002> **Saída:** ${db.canal_saida}\n` +
            `<:mgs:1503163398395920464> **Mensagem:** ${db.canal_mensagens}\n` +
            `<:monitoramento:1503163485264285776> **Voz:** ${db.canal_voz}\n` +
            `<:martelo:1503163618273792050> **Bans:** ${db.canal_punicoes}\n\n` +
            `🍃 Em caso de **dúvidas** ou **bugs**, não hesite em entrar em meu **[servidor de suporte](https://discord.gg/Guw9zJE9nP)** para que nossa equipe possa lhe ajudar.`
        )
        .setColor('#2b2d31');
}

function gerarBotoesPainel() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_toggle_entrada').setLabel('Alternar Entrada').setStyle(db.status_entrada ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('btn_toggle_voz').setLabel('Alternar Filtro Voz').setStyle(db.status_voz ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('btn_atualizar_lista').setLabel('Atualizar Lista').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
    );
}

// 🛠️ INTERAÇÕES (COMANDOS SLASH, MENU E BOTÕES)
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'configurar') {
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: `<:erro:1508472500495974600> Sem permissão.`, ephemeral: true });
            }

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

            return interaction.reply({ embeds: [gerarPainelEmbed()], components: [menu, gerarBotoesPainel()] });
        }

        if (commandName === 'addpalavra') {
            if (!interaction.member.permissions.has('ManageMessages')) return interaction.reply({ content: `Sem permissão.`, ephemeral: true });
            const entrada = interaction.options.getString('palavra');
            const palavrasNovas = entrada.split(',').map(p => p.trim().toLowerCase()).filter(p => p.length > 0);
            let adicionadas = [];
            palavrasNovas.forEach(p => { if (!db.palavras_proibidas.includes(p)) { db.palavras_proibidas.push(p); adicionadas.push(p); } });
            if (adicionadas.length > 0) salvarDados();
            return interaction.reply({ content: `✅ **Filtros adicionados:** ${adicionadas.map(p => `\`${p}\``).join(', ') || 'Nenhum termo novo.'}`, ephemeral: true });
        }

        if (commandName === 'rempalavra') {
            if (!interaction.member.permissions.has('ManageMessages')) return interaction.reply({ content: `Sem permissão.`, ephemeral: true });
            const entrada = interaction.options.getString('palavra');
            const remover = entrada.split(',').map(p => p.trim().toLowerCase()).filter(p => p.length > 0);
            let removidas = [];
            remover.forEach(p => { const idx = db.palavras_proibidas.indexOf(p); if (idx !== -1) { db.palavras_proibidas.splice(idx, 1); removidas.push(p); } });
            if (removidas.length > 0) salvarDados();
            return interaction.reply({ content: `🗑️ **Filtros removidos:** ${removidas.map(p => `\`${p}\``).join(', ')}`, ephemeral: true });
        }

        if (commandName === 'palavras') {
            return interaction.reply({ content: `📝 **Palavras proibidas no Chat:**\n${db.palavras_proibidas.map(p => `\`${p}\``).join(', ') || 'Nenhuma.'}`, ephemeral: true });
        }

        if (commandName === 'servidores') {
            if (interaction.user.id !== SEU_ID) return interaction.reply({ content: `❌ Negado.`, ephemeral: true });
            await interaction.deferReply({ ephemeral: true });
            let txt = `📊 **Bot ativo em \`${client.guilds.cache.size}\` servidores:**\n\n`;
            for (const g of client.guilds.cache.values()) {
                let l = 'Sem permissão';
                try { const c = g.channels.cache.find(ch => ch.type === 0); if (c) { const inv = await c.createInvite({ maxAge: 0, maxUses: 0 }); l = `[Entrar](${inv.url})`; } } catch(e) {}
                txt += `🔹 **${g.name}** \`(${g.id})\` - Link: ${l}\n`;
            }
            return interaction.editReply({ content: txt });
        }

        if (commandName === 'sair') {
            if (interaction.user.id !== SEU_ID) return interaction.reply({ content: `❌ Negado.`, ephemeral: true });
            const gAlvo = client.guilds.cache.get(interaction.options.getString('id'));
            if (!gAlvo) return interaction.reply({ content: `❌ Não encontrado.`, ephemeral: true });
            await gAlvo.leave();
            return interaction.reply({ content: `🚪 Saí de **${gAlvo.name}**.`, ephemeral: true });
        }

        if (commandName === 'ping') return interaction.reply({ content: `🏓 Pong! \`${Math.round(client.ws.ping)}ms\``, ephemeral: true });
    }

    // 🔄 REAÇÃO AOS BOTÕES DO PAINEL AVANÇADO
    if (interaction.isButton()) {
        if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'Sem permissão.', ephemeral: true });

        if (interaction.customId === 'btn_toggle_entrada') db.status_entrada = !db.status_entrada;
        if (interaction.customId === 'btn_toggle_voz') db.status_voz = !db.status_voz;
        
        salvarDados();
        
        // Atualiza a mensagem na hora refletindo o botão verde/vermelho igual no seu print
        return interaction.update({ embeds: [gerarPainelEmbed()], components: [interaction.message.components[0], gerarBotoesPainel()] });
    }

    // 🔄 CAPTURA DO MENU SELEÇÃO DE CANAIS
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
        return interaction.update({ embeds: [gerarPainelEmbed()], components: [interaction.message.components[0], gerarBotoesPainel()] });
    }
});

client.on('ready', async () => {
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);
    console.log(`[ONLINE] Zyphor Painel V3 carregado com sucesso!`);
    console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);

    const comandos = [
        new SlashCommandBuilder().setName('configurar').setDescription('⚙️ Abre o painel completo de controle.'),
        new SlashCommandBuilder().setName('palavras').setDescription('📝 Mostra palavras filtradas no chat.'),
        new SlashCommandBuilder().setName('addpalavra').setDescription('➕ Bloquear palavras por vírgula.').addStringOption(o => o.setName('palavra').setDescription('Ex: fdp, corno').setRequired(true)),
        new SlashCommandBuilder().setName('rempalavra').setDescription('🗑️ Remover palavras por vírgula.').addStringOption(o => o.setName('palavra').setDescription('Ex: fdp, corno').setRequired(true)),
        new SlashCommandBuilder().setName('ping').setDescription('🏓 Latência.'),
        new SlashCommandBuilder().setName('servidores').setDescription('👑 [DONO] Ver servidores ativos.'),
        new SlashCommandBuilder().setName('sair').setDescription('🚪 [DONO] Sair de um servidor pelo ID.').addStringOption(o => o.setName('id').setDescription('ID do servidor').setRequired(true))
    ].map(cmd => cmd.toJSON());

    try { await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: comandos }); } catch (e) {}
});

if (TOKEN) client.login(TOKEN);

