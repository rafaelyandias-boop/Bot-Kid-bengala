const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ChannelType, REST, Routes, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, Partials } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const BOT_OWNER_ID = process.env.BOT_OWNER_ID;
const GUILD_IDS = process.env.GUILD_IDS?.split(',') || [];

const ticketConfig = new Map();
let ticketCounter = 0;
const gameState = new Map();
const wallets = new Map();
const inventarios = new Map();
const sites = new Map();
const empresas = new Map();

function getBalance(userId) { return wallets.get(userId) || 1000; }
function addBalance(userId, amount) { const current = getBalance(userId); wallets.set(userId, current + amount); return current + amount; }
function removeBalance(userId, amount) { const current = getBalance(userId); if (current < amount) return false; wallets.set(userId, current - amount); return true; }
function getInventario(userId) { if (!inventarios.has(userId)) inventarios.set(userId, {}); return inventarios.get(userId); }
function addItem(userId, item, q = 1) { const inv = getInventario(userId); inv[item] = (inv[item] || 0) + q; }
function removeItem(userId, item, q = 1) { const inv = getInventario(userId); if (!inv[item] || inv[item] < q) return false; inv[item] -= q; if (inv[item] === 0) delete inv[item]; return true; }
function hasPermission(member, permission) { if (!member || !member.permissions) return false; return member.permissions.has ? member.permissions.has(permission) : false; }

class TicTacToe {
    constructor(p1, p2) { this.player1 = p1; this.player2 = p2; this.board = Array(9).fill(null); this.currentPlayer = p1; this.gameActive = true; }
    getBoard() { const s = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣']; let d = ''; for (let i = 0; i < 9; i++) { if (this.board[i] === 'X') d += '❌'; else if (this.board[i] === 'O') d += '⭕'; else d += s[i]; if ((i+1)%3===0) d += '\n'; } return d; }
    makeMove(pos) { if (this.board[pos] !== null) return false; this.board[pos] = this.currentPlayer === this.player1 ? 'X' : 'O'; return true; }
    checkWinner() { const l = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; for (let line of l) { if (this.board[line[0]] && this.board[line[0]] === this.board[line[1]] && this.board[line[1]] === this.board[line[2]]) return this.board[line[0]]; } return null; }
    isFull() { return this.board.every(c => c !== null); }
    switchPlayer() { this.currentPlayer = this.currentPlayer === this.player1 ? this.player2 : this.player1; }
}

const commands = [
    new SlashCommandBuilder().setName('teste').setDescription('Testa se o bot está online'),
    new SlashCommandBuilder().setName('ping').setDescription('Mostra a latência'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Info do servidor'),
    new SlashCommandBuilder().setName('userinfo').setDescription('Info de um usuário').addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(false)),
    new SlashCommandBuilder().setName('avatar').setDescription('Avatar de alguém').addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(false)),
    new SlashCommandBuilder().setName('say').setDescription('Faz o bot falar').addStringOption(o => o.setName('mensagem').setDescription('Mensagem').setRequired(true)),
    new SlashCommandBuilder().setName('dado').setDescription('Rola um dado').addIntegerOption(o => o.setName('lados').setDescription('Lados (2-100)').setRequired(false).setMinValue(2).setMaxValue(100)),
    new SlashCommandBuilder().setName('moeda').setDescription('Joga moeda'),
    new SlashCommandBuilder().setName('escolher').setDescription('Escolhe entre opções').addStringOption(o => o.setName('opcoes').setDescription('Opções separadas por vírgula').setRequired(true)),
    new SlashCommandBuilder().setName('anuncio').setDescription('Faz anúncio').addStringOption(o => o.setName('titulo').setDescription('Título').setRequired(true)).addStringOption(o => o.setName('mensagem').setDescription('Mensagem').setRequired(true)).addStringOption(o => o.setName('cor').setDescription('Cor').setRequired(false).addChoices({name:'Vermelho',value:'FF0000'},{name:'Verde',value:'00FF00'},{name:'Azul',value:'0099FF'},{name:'Amarelo',value:'FFFF00'},{name:'Roxo',value:'9933FF'})),
    new SlashCommandBuilder().setName('enquete').setDescription('Cria enquete').addStringOption(o => o.setName('pergunta').setDescription('Pergunta').setRequired(true)),
    new SlashCommandBuilder().setName('onboarding').setDescription('Menu de seleção de cargos'),
    new SlashCommandBuilder().setName('peneira').setDescription('Avalia um jogador').addUserOption(o => o.setName('jogador').setDescription('Jogador').setRequired(true)).addNumberOption(o => o.setName('finalizacao').setDescription('Nota (0-10)').setRequired(true).setMinValue(0).setMaxValue(10)).addNumberOption(o => o.setName('drible').setDescription('Nota (0-10)').setRequired(true).setMinValue(0).setMaxValue(10)).addNumberOption(o => o.setName('roubodebola').setDescription('Nota (0-10)').setRequired(true).setMinValue(0).setMaxValue(10)).addNumberOption(o => o.setName('passe').setDescription('Nota (0-10)').setRequired(true).setMinValue(0).setMaxValue(10)).addNumberOption(o => o.setName('contraataque').setDescription('Nota (0-10)').setRequired(true).setMinValue(0).setMaxValue(10)).addStringOption(o => o.setName('rank').setDescription('Rank').setRequired(true).addChoices({name:'Z+ Predator Eyes Full',value:'Z+ Predator Eyes Full'},{name:'SS+ Metavision',value:'SS+ Metavision'},{name:'SS+ Jogador coringa',value:'SS+ Jogador coringa'},{name:'S+ Wild Card Full',value:'S+ Wild Card Full'},{name:'A+ Monster',value:'A+ Monster'},{name:'B- Inutil',value:'B- Inutil'})),
    new SlashCommandBuilder().setName('ban').setDescription('Bane um usuário').addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(true)).addStringOption(o => o.setName('motivo').setDescription('Motivo').setRequired(false)),
    new SlashCommandBuilder().setName('kick').setDescription('Expulsa um usuário').addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(true)).addStringOption(o => o.setName('motivo').setDescription('Motivo').setRequired(false)),
    new SlashCommandBuilder().setName('timeout').setDescription('Silencia um usuário').addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(true)).addIntegerOption(o => o.setName('duracao').setDescription('Duração (min)').setRequired(true).setMinValue(1).setMaxValue(10080)).addStringOption(o => o.setName('motivo').setDescription('Motivo').setRequired(false)),
    new SlashCommandBuilder().setName('limpar').setDescription('Limpa mensagens').addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)),
    new SlashCommandBuilder().setName('warn').setDescription('Avisa um usuário').addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(true)).addStringOption(o => o.setName('motivo').setDescription('Motivo').setRequired(true)),
    new SlashCommandBuilder().setName('ticket-setup').setDescription('Configura tickets').addChannelOption(o => o.setName('canal').setDescription('Canal').setRequired(true).addChannelTypes(ChannelType.GuildText)).addRoleOption(o => o.setName('cargo-staff').setDescription('Cargo staff').setRequired(true)).addChannelOption(o => o.setName('categoria').setDescription('Categoria').setRequired(false).addChannelTypes(ChannelType.GuildCategory)),
    new SlashCommandBuilder().setName('ticket-close').setDescription('Fecha ticket'),
    new SlashCommandBuilder().setName('ticket-add').setDescription('Adiciona no ticket').addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(true)),
    new SlashCommandBuilder().setName('ticket-remove').setDescription('Remove do ticket').addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(true)),
    new SlashCommandBuilder().setName('ticket-rename').setDescription('Renomeia ticket').addStringOption(o => o.setName('nome').setDescription('Novo nome').setRequired(true)),
    new SlashCommandBuilder().setName('tictactoe').setDescription('Jogo da velha').addUserOption(o => o.setName('adversario').setDescription('Adversário').setRequired(true)),
    new SlashCommandBuilder().setName('ppt').setDescription('Pedra papel tesoura'),
    new SlashCommandBuilder().setName('adivinhar').setDescription('Adivinhe o número (1-100)'),
    new SlashCommandBuilder().setName('quiz').setDescription('Quiz'),
    new SlashCommandBuilder().setName('aposta-numero').setDescription('Aposte no número').addIntegerOption(o => o.setName('numero').setDescription('Número (1-20)').setRequired(true).setMinValue(1).setMaxValue(20)).addIntegerOption(o => o.setName('aposta').setDescription('Valor').setRequired(true).setMinValue(10).setMaxValue(10000)),
    new SlashCommandBuilder().setName('aposta-dados').setDescription('Aposte par/ímpar').addStringOption(o => o.setName('resultado').setDescription('Par ou Ímpar').setRequired(true).addChoices({name:'Par',value:'par'},{name:'Ímpar',value:'impar'})).addIntegerOption(o => o.setName('aposta').setDescription('Valor').setRequired(true).setMinValue(10).setMaxValue(10000)),
    new SlashCommandBuilder().setName('saldo').setDescription('Vê seu saldo'),
    new SlashCommandBuilder().setName('trabalhar').setDescription('Trabalhe').addIntegerOption(o => o.setName('horas').setDescription('Horas (1-8)').setRequired(true).setMinValue(1).setMaxValue(8)),
    new SlashCommandBuilder().setName('namoro').setDescription('Bot namora alguém').addUserOption(o => o.setName('pessoa').setDescription('Pessoa').setRequired(true)),
    new SlashCommandBuilder().setName('loja').setDescription('Loja de itens'),
    new SlashCommandBuilder().setName('inventario').setDescription('Seu inventário'),
    new SlashCommandBuilder().setName('site').setDescription('Seu site'),
    new SlashCommandBuilder().setName('empresa').setDescription('Sua empresa'),
    new SlashCommandBuilder().setName('cassino').setDescription('Caça-níqueis').addIntegerOption(o => o.setName('aposta').setDescription('Valor').setRequired(true).setMinValue(10).setMaxValue(10000)),
    new SlashCommandBuilder().setName('aposta-moeda').setDescription('Moeda').addStringOption(o => o.setName('lado').setDescription('Lado').setRequired(true).addChoices({name:'Cara',value:'cara'},{name:'Coroa',value:'coroa'})).addIntegerOption(o => o.setName('aposta').setDescription('Valor').setRequired(true).setMinValue(10).setMaxValue(10000)),
    new SlashCommandBuilder().setName('ranking').setDescription('Ranking'),
    new SlashCommandBuilder().setName('daily').setDescription('Recompensa diária'),
    new SlashCommandBuilder().setName('admin-setal').setDescription('Seta dinheiro').addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(true)).addIntegerOption(o => o.setName('quantia').setDescription('Quantia').setRequired(true).setMinValue(0).setMaxValue(999999999)),
    new SlashCommandBuilder().setName('admin-add').setDescription('Adiciona dinheiro').addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(true)).addIntegerOption(o => o.setName('quantia').setDescription('Quantia').setRequired(true).setMinValue(1).setMaxValue(999999999)),
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('⏳ Registrando...');
        for (const guildId of GUILD_IDS) {
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: commands });
            console.log(`✅ ${guildId}`);
        }
    } catch (e) { console.error('❌ Erro:', e.message); }
})();

client.once('ready', () => console.log(`✅ ${client.user.tag} online!`));

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        if (interaction.commandName === 'teste') await interaction.reply('✅ Online!');
        if (interaction.commandName === 'ping') {
            const e = new EmbedBuilder().setTitle('🏓 Pong').setDescription(`${client.ws.ping}ms`).setColor('#00FF00');
            await interaction.reply({ embeds: [e] });
        }
        if (interaction.commandName === 'serverinfo') {
            const g = interaction.guild;
            const e = new EmbedBuilder().setTitle(`📊 ${g.name}`).setThumbnail(g.iconURL()).addFields({name:'Dono',value:`<@${g.ownerId}>`,inline:true},{name:'Membros',value:`${g.memberCount}`,inline:true},{name:'Canais',value:`${g.channels.cache.size}`,inline:true}).setColor('#0099FF');
            await interaction.reply({ embeds: [e] });
        }
        if (interaction.commandName === 'userinfo') {
            const u = interaction.options.getUser('usuario') || interaction.user;
            const m = await interaction.guild.members.fetch(u.id);
            const e = new EmbedBuilder().setTitle(`👤 ${u.tag}`).setThumbnail(u.displayAvatarURL()).addFields({name:'ID',value:u.id,inline:true},{name:'Criou',value:`<t:${Math.floor(u.createdTimestamp/1000)}:D>`,inline:true},{name:'Entrou',value:`<t:${Math.floor(m.joinedTimestamp/1000)}:D>`,inline:true}).setColor('#9933FF');
            await interaction.reply({ embeds: [e] });
        }
        if (interaction.commandName === 'avatar') {
            const u = interaction.options.getUser('usuario') || interaction.user;
            const e = new EmbedBuilder().setTitle(`🖼️ ${u.tag}`).setImage(u.displayAvatarURL({size:1024})).setColor('#9933FF');
            await interaction.reply({ embeds: [e] });
        }
        if (interaction.commandName === 'say') {
            if (!hasPermission(interaction.member, PermissionFlagsBits.Administrator)) return interaction.reply({content:'❌ Admin only',flags:64});
            const msg = interaction.options.getString('mensagem');
            await interaction.reply({content:'✅ Enviado',flags:64});
            await interaction.channel.send(msg);
        }
        if (interaction.commandName === 'dado') {
            const l = interaction.options.getInteger('lados') || 6;
            const r = Math.floor(Math.random()*l)+1;
            const e = new EmbedBuilder().setTitle('🎲 Dado').setDescription(`**${r}** (1-${l})`).setColor('#FFD700');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'moeda') {
            const r = Math.random()<0.5 ? 'Cara' : 'Coroa';
            const e = new EmbedBuilder().setTitle('🪙 Moeda').setDescription(`**${r}**`).setColor('#FFA500');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'escolher') {
            const opts = interaction.options.getString('opcoes').split(',').map(o=>o.trim());
            const esc = opts[Math.floor(Math.random()*opts.length)];
            const e = new EmbedBuilder().setTitle('🎯 Escolha').setDescription(`${opts.join(', ')}\n\n**${esc}**`).setColor('#9933FF');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'anuncio') {
            if (!hasPermission(interaction.member, PermissionFlagsBits.Administrator)) return interaction.reply({content:'❌ Admin only',flags:64});
            const t = interaction.options.getString('titulo');
            const m = interaction.options.getString('mensagem');
            const c = interaction.options.getString('cor') || '0099FF';
            const e = new EmbedBuilder().setTitle(`📢 ${t}`).setDescription(m).setColor(`#${c}`).setTimestamp();
            await interaction.reply({content:'✅ Enviado',flags:64});
            await interaction.channel.send({embeds:[e]});
        }
        if (interaction.commandName === 'enquete') {
            const p = interaction.options.getString('pergunta');
            const e = new EmbedBuilder().setTitle('📊 Enquete').setDescription(p).setColor('#0099FF').setFooter({text:'✅ ou ❌'});
            const m = await interaction.reply({embeds:[e],fetchReply:true});
            await m.react('✅');
            await m.react('❌');
        }
        if (interaction.commandName === 'onboarding') {
            const menu = new StringSelectMenuBuilder().setCustomId('onboarding_menu').setPlaceholder('Escolha cargos').setMinValues(1).setMaxValues(6).addOptions([
                {label:'Parceria',value:'parceria'},{label:'Jogador',value:'jogador'},{label:'Amistoso',value:'amistoso'},{label:'Ping Amistoso',value:'ping_amistoso'},{label:'Ping Avisos',value:'ping_avisos'},{label:'Ping Eventos',value:'ping_eventos'}
            ]);
            const row = new ActionRowBuilder().addComponents(menu);
            await interaction.reply({content:'Escolha:',components:[row]});
        }
        if (interaction.commandName === 'tictactoe') {
            const opp = interaction.options.getUser('adversario');
            if (opp.id === interaction.user.id) return interaction.reply({content:'❌ Não pode',flags:64});
            const gid = `${interaction.user.id}-${opp.id}-${Date.now()}`;
            const game = new TicTacToe(interaction.user, opp);
            gameState.set(gid,game);
            const e = new EmbedBuilder().setTitle('🎮 Velha').setDescription(game.getBoard()).addFields({name:'X',value:interaction.user.username,inline:true},{name:'O',value:opp.username,inline:true}).setColor('#0099FF');
            const btns = [];
            for (let i=0;i<9;i++) {
                if (i%3===0) btns.push(new ActionRowBuilder());
                btns[Math.floor(i/3)].addComponents(new ButtonBuilder().setCustomId(`tictactoe_${gid}_${i}`).setLabel(String(i+1)).setStyle(ButtonStyle.Secondary));
            }
            await interaction.reply({embeds:[e],components:btns});
            setTimeout(()=>gameState.delete(gid),3600000);
        }
        if (interaction.commandName === 'ppt') {
            const choices = ['🪨 Pedra','📄 Papel','✂️ Tesoura'];
            const uc = Math.floor(Math.random()*3);
            const bc = Math.floor(Math.random()*3);
            let res = '';
            if (uc===bc) res = '🤝 Empate';
            else if ((uc===0&&bc===2)||(uc===1&&bc===0)||(uc===2&&bc===1)) res = '🎉 Venceu';
            else res = '😢 Perdeu';
            const e = new EmbedBuilder().setTitle('🎮 PPT').addFields({name:'Você',value:choices[uc],inline:true},{name:'Bot',value:choices[bc],inline:true},{name:'Resultado',value:res,inline:false}).setColor('#FFD700');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'adivinhar') {
            const gid = interaction.user.id;
            const num = Math.floor(Math.random()*100)+1;
            const e = new EmbedBuilder().setTitle('🎯 Adivinhe').setDescription('1-100, 10 tentativas').setColor('#00FF00');
            const msg = await interaction.reply({embeds:[e],fetchReply:true});
            gameState.set(gid,{num,att:0,max:10});
            const filter = m => m.author.id === interaction.user.id;
            const col = interaction.channel.createMessageCollector({filter,time:300000});
            col.on('collect',async m=>{
                const g = gameState.get(gid);
                const guess = parseInt(m.content);
                if (isNaN(guess)||guess<1||guess>100) return;
                g.att++;
                let hint = '';
                if (guess<g.num) hint='📈 Maior';
                else if (guess>g.num) hint='📉 Menor';
                else {hint=`🎉 Acertou em ${g.att}!`; col.stop();}
                const re = new EmbedBuilder().setTitle('🎯').setDescription(`${hint}\n${g.att}/${g.max}`).setColor(guess===g.num?'#00FF00':'#FFA500');
                await m.reply({embeds:[re],flags:64});
                if (g.att>=g.max&&guess!==g.num) {await interaction.channel.send({embeds:[new EmbedBuilder().setTitle('💔 Fim').setDescription(`${g.num}`)]}); col.stop();}
            });
            col.on('end',()=>gameState.delete(gid));
        }
        if (interaction.commandName === 'quiz') {
            const qs = [{q:'Capital da França?',opts:['Paris','Londres','Berlim','Madri'],c:0},{q:'Planeta maior?',opts:['Marte','Júpiter','Saturno','Vênus'],c:1},{q:'Oceano mais fundo?',opts:['Atlântico','Pacífico','Índico','Ártico'],c:1},{q:'Monalisa?',opts:['Michelangelo','Da Vinci','Rafael','Caravaggio'],c:1},{q:'Metal leve?',opts:['Alumínio','Lítio','Ouro','Prata'],c:1}];
            const q = qs[Math.floor(Math.random()*qs.length)];
            const btns = [];
            q.opts.forEach((o,i)=>{
                if (i%2===0) btns.push(new ActionRowBuilder());
                btns[Math.floor(i/2)].addComponents(new ButtonBuilder().setCustomId(`quiz_${i}_${q.c}`).setLabel(o).setStyle(ButtonStyle.Primary));
            });
            const e = new EmbedBuilder().setTitle('📚').setDescription(q.q).setColor('#0099FF');
            await interaction.reply({embeds:[e],components:btns});
        }
        if (interaction.commandName === 'saldo') {
            const b = getBalance(interaction.user.id);
            const e = new EmbedBuilder().setTitle('💰 Saldo').setDescription(`**${b}** moedas`).setColor('#FFD700').setThumbnail(interaction.user.displayAvatarURL());
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'trabalhar') {
            const h = interaction.options.getInteger('horas');
            const uid = interaction.user.id;
            const wk = `work_${uid}`;
            const lw = gameState.get(wk);
            const now = Date.now();
            if (lw&&now-lw<3600000) return interaction.reply({content:'⏳ Em 1h',flags:64});
            const e1 = new EmbedBuilder().setTitle('💼').setDescription(`${interaction.user.username} trabalhando ${h}h...`).setColor('#FFA500').setImage('https://media.tenor.com/sAT7sErKyFgAAAAM/work-working.gif');
            const msg = await interaction.reply({embeds:[e1],fetchReply:true});
            await new Promise(r=>setTimeout(r,2000));
            const ex = Math.random()<0.5;
            const bg = h*100;
            const gn = ex ? bg*1.5 : bg;
            addBalance(uid,Math.floor(gn));
            gameState.set(wk,now);
            const e2 = new EmbedBuilder().setTitle(ex?'🎉 Lucrativo':'💼').setDescription(`${h}h`).addFields({name:'Ganho',value:`${Math.floor(gn)}`,inline:true},{name:'Saldo',value:`${getBalance(uid)}`,inline:true}).setColor(ex?'#00FF00':'#FFA500');
            await msg.edit({embeds:[e2]});
        }
        if (interaction.commandName === 'namoro') {
            const p = interaction.options.getUser('pessoa');
            if (p.id===client.user.id) return interaction.reply({content:'❌ Inválido',flags:64});
            const e1 = new EmbedBuilder().setTitle('💕').setDescription(`Com ${p.username}...`).setColor('#FF69B4').setImage('https://tenor.com/view/fight-argue-gif-13165480');
            const msg = await interaction.reply({embeds:[e1],fetchReply:true});
            await new Promise(r=>setTimeout(r,2000));
            const comp = p.id===interaction.user.id ? 0 : 100;
            const barra = '🟥'.repeat(Math.floor(comp/5))+'⬜'.repeat(20-Math.floor(comp/5));
            const suc = comp>=50;
            const e2 = new EmbedBuilder().setTitle(suc?'💕 CASAL':'💔').setDescription(`${client.user.username} ❤️ ${p.username}\n\n${barra}\n**${comp}%**`).addFields({name:'Bot',value:client.user.username,inline:true},{name:'Pessoa',value:p.username,inline:true},{name:'Resultado',value:suc?'✅':'❌',inline:false}).setColor(suc?'#00FF00':'#FF0000').setImage(suc?'https://media.giphy.com/media/3o6ZtpgLBaGvkKAXIQ/giphy.gif':'https://media.giphy.com/media/3o85xIO33l7RlmLR20/giphy.gif');
            await msg.edit({embeds:[e2]});
        }
        if (interaction.commandName === 'loja') {
            const items = {'laptop':{p:5000,n:'💻 Laptop'},'site':{p:10000,n:'🌐 Site'},'carro':{p:20000,n:'🚗 Carro'},'casa':{p:50000,n:'🏠 Casa'},'empresa':{p:100000,n:'🏢 Empresa'}};
            let d = '';
            for (const [k,v] of Object.entries(items)) d += `${v.n} - ${v.p}\n`;
            const e = new EmbedBuilder().setTitle('🛍️').setDescription(d).setColor('#FFD700');
            const btns = [];
            let idx = 0;
            for (const [k,v] of Object.entries(items)) {
                if (idx%2===0) btns.push(new ActionRowBuilder());
                btns[Math.floor(idx/2)].addComponents(new ButtonBuilder().setCustomId(`comprar_${k}`).setLabel(v.n).setStyle(ButtonStyle.Primary));
                idx++;
            }
            await interaction.reply({embeds:[e],components:btns});
        }
        if (interaction.commandName === 'inventario') {
            const inv = getInventario(interaction.user.id);
            const items = Object.keys(inv);
            if (items.length===0) {
                const e = new EmbedBuilder().setTitle('📦 Vazio').setDescription('Sem itens').setColor('#808080');
                return interaction.reply({embeds:[e]});
            }
            let d = '';
            const nomes = {'laptop':'💻 Laptop','site':'🌐 Site','carro':'🚗 Carro','casa':'🏠 Casa','empresa':'🏢 Empresa'};
            for (const item of items) d += `${nomes[item]} - ${inv[item]}x\n`;
            const e = new EmbedBuilder().setTitle('📦').setDescription(d).setColor('#0099FF');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'site') {
            const inv = getInventario(interaction.user.id);
            if (!inv['site']) return interaction.reply({content:'❌ Sem site',flags:64});
            if (!sites.has(interaction.user.id)) sites.set(interaction.user.id,{nome:`Site de ${interaction.user.username}`,desc:'Um site top',renda:0});
            const s = sites.get(interaction.user.id);
            const e = new EmbedBuilder().setTitle('🌐 Seu Site').setDescription(s.nome).addFields({name:'Descrição',value:s.desc,inline:true},{name:'Renda',value:`${s.renda}`,inline:true}).setColor('#0099FF');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'empresa') {
            const inv = getInventario(interaction.user.id);
            if (!inv['empresa']) return interaction.reply({content:'❌ Sem empresa',flags:64});
            if (!empresas.has(interaction.user.id)) empresas.set(interaction.user.id,{nome:`Empresa de ${interaction.user.username}`,func:[],renda:0});
            const em = empresas.get(interaction.user.id);
            const e = new EmbedBuilder().setTitle('🏢').setDescription(em.nome).addFields({name:'Funcionários',value:`${em.func.length}`,inline:true},{name:'Renda',value:`${em.renda}`,inline:true}).setColor('#FFD700');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'cassino') {
            const aposta = interaction.options.getInteger('aposta');
            const uid = interaction.user.id;
            if (!removeBalance(uid,aposta)) return interaction.reply({content:`❌ Sem ${aposta}`,flags:64});
            const e1 = new EmbedBuilder().setTitle('🎰').setColor('#FFA500');
            const msg = await interaction.reply({embeds:[e1],fetchReply:true});
            await new Promise(r=>setTimeout(r,2000));
            const reels = ['🍎','🍊','🍋','7️⃣','💎'];
            const result = [reels[Math.floor(Math.random()*5)],reels[Math.floor(Math.random()*5)],reels[Math.floor(Math.random()*5)]];
            let ganho = 0;
            if (result[0]===result[1]&&result[1]===result[2]) ganho = result[0]==='💎' ? aposta*20 : result[0]==='7️⃣' ? aposta*10 : aposta*5;
            else if (result[0]===result[1]||result[1]===result[2]) ganho = aposta*2;
            addBalance(uid,ganho);
            const e2 = new EmbedBuilder().setTitle(ganho>0?'🎉':'💔').setDescription(`${result.join(' ')}`).addFields({name:'Ganho',value:`${ganho}`,inline:true},{name:'Saldo',value:`${getBalance(uid)}`,inline:true}).setColor(ganho>0?'#00FF00':'#FF0000').setImage(ganho>0?'https://media.giphy.com/media/3o6ZtpgLBaGvkKAXIQ/giphy.gif':'https://media.giphy.com/media/3o85xIO33l7RlmLR20/giphy.gif');
            await msg.edit({embeds:[e2]});
        }
        if (interaction.commandName === 'aposta-moeda') {
            const lado = interaction.options.getString('lado');
            const aposta = interaction.options.getInteger('aposta');
            const uid = interaction.user.id;
            if (!removeBalance(uid,aposta)) return interaction.reply({content:`❌ Sem ${aposta}`,flags:64});
            const e1 = new EmbedBuilder().setTitle('🪙').setColor('#FFA500');
            const msg = await interaction.reply({embeds:[e1],fetchReply:true});
            await new Promise(r=>setTimeout(r,2000));
            const result = Math.random()<0.5 ? 'cara' : 'coroa';
            const ganhou = lado===result;
            const ganho = ganhou ? aposta*2 : 0;
            addBalance(uid,ganho);
            const e2 = new EmbedBuilder().setTitle(ganhou?'🎉':'💔').addFields({name:'Resultado',value:result.toUpperCase(),inline:true},{name:'Ganho',value:`${ganho}`,inline:true},{name:'Saldo',value:`${getBalance(uid)}`,inline:true}).setColor(ganhou?'#00FF00':'#FF0000').setImage(ganhou?'https://media.giphy.com/media/3o6ZtpgLBaGvkKAXIQ/giphy.gif':'https://media.giphy.com/media/3o85xIO33l7RlmLR20/giphy.gif');
            await msg.edit({embeds:[e2]});
        }
        if (interaction.commandName === 'aposta-numero') {
            const numero = interaction.options.getInteger('numero');
            const aposta = interaction.options.getInteger('aposta');
            const uid = interaction.user.id;
            if (!removeBalance(uid,aposta)) return interaction.reply({content:`❌ Sem ${aposta}`,flags:64});
            const e1 = new EmbedBuilder().setTitle('🎯').setColor('#FFA500');
            const msg = await interaction.reply({embeds:[e1],fetchReply:true});
            await new Promise(r=>setTimeout(r,2000));
            const resultado = Math.floor(Math.random()*20)+1;
            const ganhou = numero===resultado;
            const ganho = ganhou ? aposta*15 : 0;
            addBalance(uid,ganho);
            const e2 = new EmbedBuilder().setTitle(ganhou?'🎉':'💔').addFields({name:'Seu número',value:`${numero}`,inline:true},{name:'Sorteado',value:`${resultado}`,inline:true},{name:'Ganho',value:`${ganho}`,inline:true},{name:'Saldo',value:`${getBalance(uid)}`,inline:true}).setColor(ganhou?'#00FF00':'#FF0000').setImage(ganhou?'https://media.giphy.com/media/3o6ZtpgLBaGvkKAXIQ/giphy.gif':'https://media.giphy.com/media/3o85xIO33l7RlmLR20/giphy.gif');
            await msg.edit({embeds:[e2]});
        }
        if (interaction.commandName === 'aposta-dados') {
            const resultado = interaction.options.getString('resultado');
            const aposta = interaction.options.getInteger('aposta');
            const uid = interaction.user.id;
            if (!removeBalance(uid,aposta)) return interaction.reply({content:`❌ Sem ${aposta}`,flags:64});
            const e1 = new EmbedBuilder().setTitle('🎲').setColor('#FFA500');
            const msg = await interaction.reply({embeds:[e1],fetchReply:true});
            await new Promise(r=>setTimeout(r,2000));
            const d1 = Math.floor(Math.random()*6)+1;
            const d2 = Math.floor(Math.random()*6)+1;
            const soma = d1+d2;
            const ehPar = soma%2===0;
            const ganhou = (resultado==='par'&&ehPar)||(resultado==='impar'&&!ehPar);
            const ganho = ganhou ? aposta*2 : 0;
            addBalance(uid,ganho);
            const e2 = new EmbedBuilder().setTitle(ganhou?'🎉':'💔').addFields({name:'Dados',value:`${d1}+${d2}=${soma}`,inline:true},{name:'Escolha',value:resultado.toUpperCase(),inline:true},{name:'Resultado',value:ehPar?'PAR':'ÍMPAR',inline:false},{name:'Ganho',value:`${ganho}`,inline:true},{name:'Saldo',value:`${getBalance(uid)}`,inline:true}).setColor(ganhou?'#00FF00':'#FF0000').setImage(ganhou?'https://media.giphy.com/media/3o6ZtpgLBaGvkKAXIQ/giphy.gif':'https://media.giphy.com/media/3o85xIO33l7RlmLR20/giphy.gif');
            await msg.edit({embeds:[e2]});
        }
        if (interaction.commandName === 'ranking') {
            let ranking = Array.from(wallets.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10);
            if (ranking.length===0) return interaction.reply({content:'❌ Sem dados',flags:64});
            let d = '';
            for (let i=0;i<ranking.length;i++) {
                const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}️⃣`;
                d += `${medal} <@${ranking[i][0]}> - **${ranking[i][1]}**\n`;
            }
            const e = new EmbedBuilder().setTitle('🏆').setDescription(d).setColor('#FFD700');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'daily') {
            const uid = interaction.user.id;
            const dk = `daily_${uid}`;
            const ld = gameState.get(dk);
            const now = Date.now();
            if (ld&&now-ld<86400000) {
                const h = Math.ceil((86400000-(now-ld))/3600000);
                return interaction.reply({content:`⏳ Em ${h}h`,flags:64});
            }
            addBalance(uid,500);
            gameState.set(dk,now);
            const e = new EmbedBuilder().setTitle('📅').setDescription('+500').addFields({name:'Saldo',value:`${getBalance(uid)}`}).setColor('#00FF00');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'admin-setal') {
            if (interaction.user.id!==BOT_OWNER_ID) return interaction.reply({content:'❌ Sem perm',flags:64});
            const u = interaction.options.getUser('usuario');
            const qtd = interaction.options.getInteger('quantia');
            wallets.set(u.id,qtd);
            const e = new EmbedBuilder().setTitle('✅').addFields({name:'User',value:u.tag,inline:true},{name:'Saldo',value:`${qtd}`,inline:true}).setColor('#00FF00');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'admin-add') {
            if (interaction.user.id!==BOT_OWNER_ID) return interaction.reply({content:'❌ Sem perm',flags:64});
            const u = interaction.options.getUser('usuario');
            const qtd = interaction.options.getInteger('quantia');
            const nb = addBalance(u.id,qtd);
            const e = new EmbedBuilder().setTitle('✅').addFields({name:'User',value:u.tag,inline:true},{name:'+',value:`${qtd}`,inline:true},{name:'Novo',value:`${nb}`,inline:true}).setColor('#00FF00');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'ban') {
            if (!hasPermission(interaction.member,PermissionFlagsBits.BanMembers)) return interaction.reply({content:'❌ Sem perm',flags:64});
            const u = interaction.options.getUser('usuario');
            const motivo = interaction.options.getString('motivo')||'Sem motivo';
            const m = await interaction.guild.members.fetch(u.id);
            if (!m.bannable) return interaction.reply({content:'❌ Não posso',flags:64});
            await m.ban({reason:motivo});
            const e = new EmbedBuilder().setTitle('🔨 Ban').addFields({name:'User',value:u.tag,inline:true},{name:'Motivo',value:motivo,inline:true}).setColor('#FF0000');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'kick') {
            if (!hasPermission(interaction.member,PermissionFlagsBits.KickMembers)) return interaction.reply({content:'❌ Sem perm',flags:64});
            const u = interaction.options.getUser('usuario');
            const motivo = interaction.options.getString('motivo')||'Sem motivo';
            const m = await interaction.guild.members.fetch(u.id);
            if (!m.kickable) return interaction.reply({content:'❌ Não posso',flags:64});
            await m.kick(motivo);
            const e = new EmbedBuilder().setTitle('👢').addFields({name:'User',value:u.tag,inline:true},{name:'Motivo',value:motivo,inline:true}).setColor('#FFA500');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'timeout') {
            if (!hasPermission(interaction.member,PermissionFlagsBits.ModerateMembers)) return interaction.reply({content:'❌ Sem perm',flags:64});
            const u = interaction.options.getUser('usuario');
            const dur = interaction.options.getInteger('duracao');
            const motivo = interaction.options.getString('motivo')||'Sem motivo';
            const m = await interaction.guild.members.fetch(u.id);
            if (!m.moderatable) return interaction.reply({content:'❌ Não posso',flags:64});
            await m.timeout(dur*60*1000,motivo);
            const e = new EmbedBuilder().setTitle('🔇').addFields({name:'User',value:u.tag,inline:true},{name:'Tempo',value:`${dur}min`,inline:true}).setColor('#FFD700');
            await interaction.reply({embeds:[e]});
        }
        if (interaction.commandName === 'limpar') {
            if (!hasPermission(interaction.member,PermissionFlagsBits.ManageMessages)) return interaction.reply({content:'❌ Sem perm',flags:64});
            const qtd = interaction.options.getInteger('quantidade');
            const deleted = await interaction.channel.bulkDelete(qtd,true);
            await interaction.reply({content:`✅ ${deleted.size} deletadas`,flags:64});
        }
        if (interaction.commandName === 'warn') {
            if (!hasPermission(interaction.member,PermissionFlagsBits.ModerateMembers)) return interaction.reply({content:'❌ Sem perm',flags:64});
            const u = interaction.options.getUser('usuario');
            const motivo = interaction.options.getString('motivo');
            const e = new EmbedBuilder().setTitle('⚠️').addFields({name:'User',value:u.tag,inline:true},{name:'Motivo',value:motivo,inline:true}).setColor('#FFFF00');
            await interaction.reply({embeds:[e]});
            try {await u.send(`⚠️ ${interaction.guild.name}\nMotivo: ${motivo}`);} catch {}
        }
        if (interaction.commandName === 'peneira') {
            if (!hasPermission(interaction.member,PermissionFlagsBits.ModerateMembers)) return interaction.reply({content:'❌ Sem perm',flags:64});
            const u = interaction.options.getUser('jogador');
            const f = interaction.options.getNumber('finalizacao');
            const dr = interaction.options.getNumber('drible');
            const rb = interaction.options.getNumber('roubodebola');
            const p = interaction.options.getNumber('passe');
            const ca = interaction.options.getNumber('contraataque');
            const r = interaction.options.getString('rank');
            const e = new EmbedBuilder().setTitle('⚽ Peneira').addFields({name:'Jogador',value:u.tag,inline:true},{name:'Rank',value:r,inline:true},{name:'Finalização',value:`${f}`,inline:true},{name:'Drible',value:`${dr}`,inline:true},{name:'Roubo',value:`${rb}`,inline:true},{name:'Passe',value:`${p}`,inline:true},{name:'Contra-Ataque',value:`${ca}`,inline:true}).setColor('#0099FF');
            await interaction.reply({embeds:[e]});
        }

    } catch (e) {
        console.error('Erro:',e.message);
        if (!interaction.replied&&!interaction.deferred) await interaction.reply({content:'❌ Erro',flags:64});
    }
});

client.on('interactionCreate',async (interaction)=>{
    if (!interaction.isButton()&&!interaction.isStringSelectMenu()) return;
    try {
        if (interaction.isStringSelectMenu()&&interaction.customId==='onboarding_menu') {
            const m = new Map([['parceria','Parceria 🤝'],['jogador','Ser Jogador 🎮'],['amistoso','Amistoso 💀'],['ping_amistoso','Ping Amistoso ⚽'],['ping_avisos','Ping Avisos 🚨'],['ping_eventos','Ping Eventos 🌐']]);
            const member = interaction.member;
            for (const val of interaction.values) {
                const rn = m.get(val);
                if (!rn) continue;
                let role = interaction.guild.roles.cache.find(r=>r.name===rn);
                if (!role) role = await interaction.guild.roles.create({name:rn,reason:'Bot',mentionable:true});
                await member.roles.add(role);
            }
            await interaction.reply({content:'✅',flags:64});
        }
        if (interaction.isButton()&&interaction.customId.startsWith('tictactoe_')) {
            const [,gid,pos] = interaction.customId.split('_');
            const game = gameState.get(gid);
            if (!game) return interaction.reply({content:'❌',flags:64});
            if (interaction.user.id!==game.currentPlayer.id) return interaction.reply({content:'❌',flags:64});
            if (!game.makeMove(parseInt(pos))) return interaction.reply({content:'❌',flags:64});
            const winner = game.checkWinner();
            const full = game.isFull();
            let rt = '';
            if (winner) {
                const wn = winner==='X' ? game.player1.username : game.player2.username;
                rt = `\n\n🎉 ${wn}`;
                game.gameActive = false;
            } else if (full) {
                rt = '\n\n🤝 Empate';
                game.gameActive = false;
            }
            const e = new EmbedBuilder().setTitle('🎮').setDescription(`${game.getBoard()}${rt}`).setColor('#0099FF');
            const btns = [];
            for (let i=0;i<9;i++) {
                if (i%3===0) btns.push(new ActionRowBuilder());
                const btn = new ButtonBuilder().setCustomId(`tictactoe_${gid}_${i}`).setStyle(ButtonStyle.Secondary);
                if (game.board[i]==='X') btn.setLabel('❌').setDisabled(true);
                else if (game.board[i]==='O') btn.setLabel('⭕').setDisabled(true);
                else btn.setLabel(String(i+1));
                btns[Math.floor(i/3)].addComponents(btn);
            }
            if (!game.gameActive) btns.forEach(row=>row.components.forEach(btn=>btn.setDisabled(true)));
            else game.switchPlayer();
            await interaction.update({embeds:[e],components:btns});
        }
        if (interaction.isButton()&&interaction.customId.startsWith('quiz_')) {
            const [,ua,ca] = interaction.customId.split('_');
            if (parseInt(ua)===parseInt(ca)) {
                addBalance(interaction.user.id,50);
                const e = new EmbedBuilder().setTitle('✅').setDescription('+50').setColor('#00FF00');
                await interaction.reply({embeds:[e],flags:64});
            } else {
                const e = new EmbedBuilder().setTitle('❌').setColor('#FF0000');
                await interaction.reply({embeds:[e],flags:64});
            }
        }
        if (interaction.isButton()&&interaction.customId.startsWith('comprar_')) {
            const item = interaction.customId.split('_')[1];
            const items = {'laptop':{p:5000,n:'💻 Laptop'},'site':{p:10000,n:'🌐 Site'},'carro':{p:20000,n:'🚗 Carro'},'casa':{p:50000,n:'🏠 Casa'},'empresa':{p:100000,n:'🏢 Empresa'}};
            const ii = items[item];
            const uid = interaction.user.id;
            if (!removeBalance(uid,ii.p)) return interaction.reply({content:`❌ Sem ${ii.p}`,flags:64});
            addItem(uid,item);
            const e = new EmbedBuilder().setTitle('✅').setDescription(ii.n).addFields({name:'Preço',value:`${ii.p}`,inline:true},{name:'Saldo',value:`${getBalance(uid)}`,inline:true}).setColor('#00FF00');
            await interaction.reply({embeds:[e],flags:64});
        }
    } catch (e) { console.error('Erro:',e.message); }
});

client.login(TOKEN);