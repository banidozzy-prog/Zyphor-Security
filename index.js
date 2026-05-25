const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const unidecode = require('unidecode');
const fs = require('fs');
const http = require('http');

http.createServer((req, res) => res.end('Zyphor Online')).listen(process.env.PORT || 3000);

const TOKEN = process.env.DISCORD_TOKEN;
const DEV_ID = '1460149186577174680';
let db = { servidores: {}, global: { logBan: null, logMsg: null }, palavras_proibidas: ['fdp', 'pnc'] };
if (fs.existsSync('./db.json')) db = JSON.parse(fs.readFileSync('./db.json', 'utf-8'));
function save() { fs.writeFileSync('./db.json', JSON.stringify(db, null, 2)); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

function checar(t) { return db.palavras_proibidas.some(p => unidecode(t).toLowerCase().includes(p)); }

client.on('messageCreate', async (m) => {
    if (m.author.bot || !m.guild) return;
    if (checar(m.content)) {
        await m.delete().catch(() => {});
        const s = db.servidores[m.guild.id];
        if (s?.logMsg) {
            client.channels.cache.get(s.logMsg)?.send({ embeds: [new EmbedBuilder().setTitle('📝 Filtro: Mensagem Bloqueada').setColor('#FFCC00').setDescription(`👤 **Usuário:** ${m.author.tag}\n💬 **Conteúdo:** \`${m.content}\`\n📍 **Canal:** <#${m.channel.id}>`)]});
        }
        if (db.global.logMsg) client.channels.cache.get(db.global.logMsg)?.send(`🌐 **[GLOBAL]** Servidor \`${m.guild.name}\`: ${m.author.tag} enviou msg proibida.`);
    }
});

client.on('interactionCreate', async (i) => {
    if (i.isChatInputCommand()) {
        if (i.commandName === 'dev') {
            if (i.user.id !== DEV_ID) return i.reply({ content: '❌ **Acesso negado!**', ephemeral: true });
            const sub = i.options.getSubcommand();
            if (sub === 'logban') { db.global.logBan = i.options.getChannel('c').id; save(); i.reply('✅ **Log global de BAN setado com sucesso!**'); }
            if (sub === 'servidores') i.reply({ content: `🖥️ **Servidores conectados:**\n${client.guilds.cache.map(g => `**${g.name}** | ID: \`${g.id}\` | 👥 ${g.memberCount}`).join('\n')}`, ephemeral: true });
            if (sub === 'sair') { const g = client.guilds.cache.get(i.options.getString('id')); await g?.leave(); i.reply(`✅ **Saí do servidor com sucesso!**`); }
        }

        if (i.commandName === 'configurar') {
            if (!i.member.permissions.has('ManageGuild')) return i.reply({ content: '❌ **Permissão negada!**', ephemeral: true });
            const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('m').addOptions([
                { label: 'Alterar Canal de Bans 🔨', value: 'logBan' },
                { label: 'Alterar Canal de Mensagens 📝', value: 'logMsg' }
            ]));
            i.reply({ content: '⚙️ **Selecione o canal para configurar:**', components: [menu], ephemeral: true });
        }
    }

    if (i.isStringSelectMenu()) {
        if (!db.servidores[i.guild.id]) db.servidores[i.guild.id] = {};
        db.servidores[i.guild.id][i.values[0]] = i.channel.id;
        save(); i.reply({ content: `✅ **Canal ${i.values[0].replace('log', '').toUpperCase()} definido com sucesso!**`, ephemeral: true });
    }
});

client.on('ready', async () => {
    const cmds = [
        new SlashCommandBuilder().setName('configurar').setDescription('⚙️ Configura os canais do servidor'),
        new SlashCommandBuilder().setName('dev').setDescription('🛠️ Painel exclusivo de desenvolvedor')
            .addSubcommand(s => s.setName('logban').addChannelOption(o => o.setName('c').setDescription('Canal').setRequired(true)))
            .addSubcommand(s => s.setName('servidores').setDescription('Lista servidores'))
            .addSubcommand(s => s.setName('sair').addStringOption(o => o.setName('id').setDescription('ID do servidor').setRequired(true)))
    ];
    await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationCommands(client.user.id), { body: cmds });
    console.log('✅ Zyphor V3 Online com Emojis!');
});

client.login(TOKEN);

