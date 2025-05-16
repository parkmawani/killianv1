const fs = require('fs');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const path = require('path');
const { startNoticeWatcher } = require('./noticeWatcher');
const { startUpdateWatcher} = require('./updateWatcher');
require('dotenv').config();

// notice-config.json 경로 정의
const configPath = path.join(__dirname, 'channel-config.json');

// 파일이 없으면 기본 설정으로 생성
if (!fs.existsSync(configPath)) {
    const defaultConfig = { noticeChannelId: null, updateChannelId: null };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    console.log('[✔] channel-config.json 파일이 생성되었습니다.');
}

// 파일 읽기
let config;
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (err) {
    console.error('[❌] channel-config.json 파싱 실패:', err);
    config = {noticeChannelId: null,
    updateChannelId: null
    };
}

// 공지 채널 ID 가져오기
const noticeChannelId = config.noticeChannelId;
const updateChannelId = config.updateChannelId;

// 클라이언트 생성
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 공지 채널 ID 설정
client.noticeChannelId = noticeChannelId;
client.updateChannelId = updateChannelId;

// 명령어 로딩
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// 봇이 준비되었을 때
client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`공지 채널 ID: ${client.noticeChannelId}`);
    console.log(`업데이트 채널 ID: ${client.updateChannelId}`);
    startNoticeWatcher(client);
    startUpdateWatcher(client);
});


client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
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
    } else if (interaction.isStringSelectMenu()) {
        // eventmaker.js 의 handleSelect 호출
        const eventmakerCommand = client.commands.get('events');
        if (!eventmakerCommand) return;
        try {
            await eventmakerCommand.handleSelect(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ 선택 처리 중 오류가 발생했습니다.' });
            } else {
                await interaction.reply({ content: '❌ 선택 처리 중 오류가 발생했습니다.', ephemeral: true });
            }
        }
    }
});

// 봇 로그인
client.login(process.env.TOKEN);
