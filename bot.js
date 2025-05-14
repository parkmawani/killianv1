const fs = require('fs');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const path = require('path');
const { startNoticeWatcher } = require('./noticeWatcher');  // 추가된 부분
require('dotenv').config();

// notice-config.json에서 공지 채널 ID 읽기
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'channel-config.json')));
const noticeChannelId = config.noticeChannelId;

// 클라이언트 생성
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 공지 채널 ID 설정 (notice-config.json에서 불러옴)
client.noticeChannelId = noticeChannelId;

// 명령어 로딩
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// 봇이 준비되었을 때 로그
client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`공지 채널 ID: ${client.noticeChannelId}`); // 공지 채널 ID 로그로 출력

    startNoticeWatcher(client);  // 공지 감시 기능 시작
});

// 슬래시 명령어 실행 핸들러
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ 명령어 실행 중 오류가 발생했습니다.' });
        } else {
            await interaction.reply({ content: '❌ 명령어 실행 중 오류가 발생했습니다.', ephemeral: true });
        }
    }
});

// 봇 로그인
client.login(process.env.TOKEN);
