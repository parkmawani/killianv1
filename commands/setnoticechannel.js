const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('채널설정')
        .setDescription('공지 채널을 설정합니다.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('공지 채널로 설정할 텍스트 채널을 선택해주세요.')
                .setRequired(true)),
    async execute(interaction) {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({ content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.', ephemeral: true });
        }
        // 선택한 채널
        const channel = interaction.options.getChannel('channel');

        // 채널 타입 확인 (디버깅용)
        console.log(`선택된 채널 ID: ${channel.id}`);
        console.log(`선택된 채널 타입: ${channel.type}`);  // 0: GUILD_TEXT


        // 채널이 텍스트 채널이 아닐 경우
        if (channel.type !== 0) {  // 0은 GUILD_TEXT를 의미
            console.log('❌ 텍스트 채널만 설정할 수 있습니다.');
            return interaction.reply({ content: '❌ 텍스트 채널만 설정할 수 있습니다.', ephemeral: true });
        }

        // channel-config.json 파일 경로
        const channelConfigPath = path.join(__dirname, '..', 'channel-config.json');

        // 기존 설정을 읽어오기
        let channelConfig = {};
        if (fs.existsSync(channelConfigPath)) {
            channelConfig = JSON.parse(fs.readFileSync(channelConfigPath, 'utf-8'));
        }

        // 채널 ID 저장
        channelConfig.noticeChannelId = channel.id;

        // 파일에 저장
        fs.writeFileSync(channelConfigPath, JSON.stringify(channelConfig, null, 2));

        // 응답
        console.log(`공지 채널이 <#${channel.id}>로 설정되었습니다.`);
        return interaction.reply({ content: `✅ 공지 채널이 <#${channel.id}>로 설정되었습니다.`, ephemeral: true });
    },
};
