const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes, StringSelectMenuBuilder 
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const emojis = {
  criar: "<:criar:1507816968286375976>",
  confirmar: "<:corfimar:1509027559701086258>",
  suporte: "<:Suporte:1501991877438738477>"
};

// 1. REGISTRO DE COMANDOS
const commands = [
    new SlashCommandBuilder()
        .setName('painelticket')
        .setDescription('Cria o painel de atendimento')
        .addStringOption(o => o.setName('titulo').setDescription('Título').setRequired(true))
        .addStringOption(o => o.setName('descricao').setDescription('Descrição').setRequired(true))
        .addChannelOption(o => o.setName('destino').setDescription('Local de criação').setRequired(true))
        .addStringOption(o => o.setName('formato').setDescription('Tipo').addChoices({ name: 'Tópico', value: 'thread' }, { name: 'Canal', value: 'canal' }).setRequired(true))
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Bot Online e Comandos Registrados!');
});

// 2. LÓGICA DO BOT
client.on('interactionCreate', async (interaction) => {
    
    // Comando /painelticket
    if (interaction.isChatInputCommand() && interaction.commandName === 'painelticket') {
        const { titulo, descricao, destino, formato } = { 
            titulo: interaction.options.getString('titulo'),
            descricao: interaction.options.getString('descricao'),
            destino: interaction.options.getChannel('destino'),
            formato: interaction.options.getString('formato')
        };

        const embed = new EmbedBuilder().setTitle(`${emojis.suporte} ${titulo}`).setDescription(descricao).setColor('Blurple');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`abrir_${formato}_${destino.id}`).setLabel('Abrir Ticket').setEmoji(emojis.criar).setStyle(ButtonStyle.Primary)
        );
        await interaction.reply({ embeds: [embed], components: [row] });
    }

    // Abertura de Ticket
    if (interaction.isButton() && interaction.customId.startsWith('abrir_')) {
        const [_, formato, id] = interaction.customId.split('_');
        
        // Trava: 1 ticket por usuário
        const existe = interaction.guild.channels.cache.find(c => c.name.includes(interaction.user.username.toLowerCase()));
        if (existe) return interaction.reply({ content: "❌ Você já tem um ticket aberto!", ephemeral: true });

        let novoTicket;
        if (formato === 'thread') {
            novoTicket = await interaction.guild.channels.cache.get(id).threads.create({ name: `Ticket de ${interaction.user.username}`, type: ChannelType.PrivateThread });
        } else {
            novoTicket = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username}`, type: ChannelType.GuildText, parent: id });
        }

        const btnAtender = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("atender_ticket").setLabel("Atender Ticket").setStyle(ButtonStyle.Success).setEmoji(emojis.confirmar)
        );
        await novoTicket.send({ content: `📢 ${interaction.user} abriu um ticket. Um staff deve clicar abaixo para assumir.`, components: [btnAtender] });
        await interaction.reply({ content: `✅ Ticket criado em: ${novoTicket}`, ephemeral: true });
    }

    // Atendimento Exclusivo (1 Staff)
    if (interaction.isButton() && interaction.customId === "atender_ticket") {
        if (interaction.message.components[0].components[0].disabled) return interaction.reply({ content: "❌ Já está sendo atendido.", ephemeral: true });

        const rowDisabled = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("atender_ticket").setLabel(`Atendido por ${interaction.user.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
        await interaction.message.edit({ components: [rowDisabled] });
        await interaction.reply({ content: `✅ Você assumiu o ticket!` });
    }
});

client.login(process.env.DISCORD_TOKEN);
