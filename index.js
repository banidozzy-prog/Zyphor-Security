const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const FILE_PATH = './config-zyphor.json';

let db = {
    canal_mensagens: null,
    canal_punicoes: null,
    termos_raid: ['org', 'lideranca', 'apgratis', 'gratis', 'vagas', 'recrutamento', 'adm', '1ap']
};

if (fs.existsSync(FILE_PATH)) { try { db = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8')); } catch(e) {} }
function salvarDados() { fs.writeFileSync(FILE_PATH, JSON.stringify(db, null, 2)); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

function limparTexto(texto) {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

// Lógica de Logs igual ao Zany (Embeds detalhadas)
async function enviarLogBan(user, guild, motivo) {
    const canal = client.channels.cache.get(db.canal_punicoes);
    if (!canal) return;

    let convite = 'Não disponível';
    try {
        const canalConvite = guild.channels.cache.find(c => c.type === 0);
        if (canalConvite) convite = (await canalConvite.createInvite({ maxAge: 0 })).url;
    } catch(e) {}

    const embed = new EmbedBuilder()
        .setTitle('🔨 Punição: Banimento Global')
        .setColor('#FF0000')
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setDescription(`**Usuário:** ${user.tag}\n**ID:** \`${user.id}\`\n**Motivo:** ${motivo}\n**Servidor:** ${guild.name}\n**Convite:** ${convite}`)
        .setTimestamp();
    canal.send({ embeds: [embed] });
}

client.on('guildMemberAdd', async (member) => {
    const nome = limparTexto(member.user.username + (member.nickname || ''));
    if (db.termos_raid.some(t => nome.includes(limparTexto(t)))) {
        await enviarLogBan(member.user, member.guild, 'Termo proibido no nick (Anti-Raid)');
        for (const guild of client.guilds.cache.values()) {
            try { await guild.members.ban(member.user.id); } catch (e) {}
        }
    }
});

// Comandos e Menus de Configuração
client.on('interactionCreate', async (i) => {
    if (i.isChatInputCommand()) {
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu-config').setOptions([
                { label: 'Definir canal de Mensagens', value: 'set_mensagens' },
                { label: 'Definir canal de Punições (Bans)', value: 'set_bans' }
            ])
        );
        i.reply({ content: 'Selecione o canal para configurar:', components: [menu], ephemeral: true });
    } else if (i.isStringSelectMenu()) {
        if (i.values[0] === 'set_mensagens') db.canal_mensagens = i.channel.id;
        if (i.values[0] === 'set_bans') db.canal_punicoes = i.channel.id;
        salvarDados();
        i.reply({ content: `✅ Canal ${i.values[0]} configurado!`, ephemeral: true });
    }
});

client.on('ready', async () => {
    const comandos = [new SlashCommandBuilder().setName('configurar').setDescription('Menu de logs Zyphor')];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: comandos });
    console.log('Zyphor V3 Online (Modo Zany)!');
});

client.login(TOKEN);

