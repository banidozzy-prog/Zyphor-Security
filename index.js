const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes 
} = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ] 
});

const db = { entrada: {}, saida: {}, canal: {} };
const emojis = { criar: "<:criar:1507816968286375976>", confirmar: "<:corfimar:1509027559701086258>", suporte: "<:Suporte:1501991877438738477>" };

const commands = [
    new SlashCommandBuilder().setName('painelticket').setDescription('Cria painel de ticket')
        .addStringOption(o => o.setName('titulo').setDescription('Título').setRequired(true))
        .addStringOption(o => o.setName('descricao').setDescription('Descrição').setRequired(true))
        .addChannelOption(o => o.setName('destino').setDescription('Local').setRequired(true))
        .addStringOption(o => o.setName('formato').setDescription('Tipo').addChoices({ name: 'Tópico', value: 'thread' }, { name: 'Canal', value: 'canal' }).setRequired(true)),
    new SlashCommandBuilder().setName('configurar').setDescription('Configura entrada/saída')
        .addChannelOption(o => o.setName('canal').setDescription('Canal de logs').setRequired(true))
        .addStringOption(o => o.setName('entrada').setDescription('Msg entrada ({user})').setRequired(true))
        .addStringOption(o => o.setName('saida').setDescription('Msg saída ({user})').setRequired(true))
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Bot Online!');
});

client.on('interactionCreate', async (i) => {
    // Comando /painelticket
    if (i.isChatInputCommand() && i.commandName === 'painelticket') {
        const embed = new EmbedBuilder().setTitle(`${emojis.suporte} ${i.options.getString('titulo')}`).setDescription(i.options.getString('descricao')).setColor('Blurple');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`abrir_${i.options.getString('formato')}_${i.options.getChannel('destino').id}`).setLabel('Abrir Ticket').setEmoji(emojis.criar).setStyle(ButtonStyle.Primary));
        await i.reply({ embeds: [embed], components: [row] });
    }

    // Comando /configurar
    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        db.canal[i.guild.id] = i.options.getChannel('canal').id;
        db.entrada[i.guild.id] = i.options.getString('entrada');
        db.saida[i.guild.id] = i.options.getString('saida');
        await i.reply({ content: `✅ Sistema configurado no canal <#${db.canal[i.guild.id]}>`, ephemeral: true });
    }

    // Lógica de Ticket
    if (i.isButton() && i.customId.startsWith('abrir_')) {
        const [_, formato, id] = i.customId.split('_');
        if (i.guild.channels.cache.find(c => c.name.includes(i.user.username.toLowerCase()))) return i.reply({ content: "❌ Ticket já aberto!", ephemeral: true });
        
        let t = formato === 'thread' ? await i.guild.channels.cache.get(id).threads.create({ name: `Ticket-${i.user.username}`, type: ChannelType.PrivateThread }) : await i.guild.channels.create({ name: `ticket-${i.user.username}`, type: ChannelType.GuildText, parent: id });
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("atender_ticket").setLabel("Atender Ticket").setStyle(ButtonStyle.Success).setEmoji(emojis.confirmar));
        await t.send({ content: `📢 ${i.user} abriu um ticket.`, components: [btn] });
        await i.reply({ content: `✅ Ticket criado!`, ephemeral: true });
    }

    if (i.isButton() && i.customId === "atender_ticket") {
        if (i.message.components[0].components[0].disabled) return i.reply({ content: "❌ Já atendido.", ephemeral: true });
        await i.message.edit({ components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("atender_ticket").setLabel(`Atendido por ${i.user.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true))] });
        await i.reply({ content: `✅ Você assumiu!` });
    }
});

// Eventos de Entrada/Saída
client.on('guildMemberAdd', async (m) => {
    if (!db.canal[m.guild.id]) return;
    m.guild.channels.cache.get(db.canal[m.guild.id]).send({ embeds: [new EmbedBuilder().setTitle("👋 Bem-vindo!").setDescription(db.entrada[m.guild.id].replace('{user}', `<@${m.id}>`)).setColor('Green')] });
});

client.on('guildMemberRemove', async (m) => {
    if (!db.canal[m.guild.id]) return;
    m.guild.channels.cache.get(db.canal[m.guild.id]).send({ embeds: [new EmbedBuilder().setTitle("👋 Adeus!").setDescription(db.saida[m.guild.id].replace('{user}', m.user.username)).setColor('Red')] });
});

client.login(process.env.DISCORD_TOKEN);

