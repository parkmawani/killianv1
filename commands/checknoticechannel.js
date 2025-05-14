const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('채널확인')
        .setDescription('현재 설정된 공지 채널을 확인합니다.'),
    async execute(interaction) {
        try {
            // 공지 채널을 저장한 변수 또는 저장소에서 불러오기
            const noticeChannelId = interaction.client.noticeChannelId;  // 가정: 봇에 설정된 공지 채널 ID가 여기에 저장되어 있음

            if (!noticeChannelId) {
                return await interaction.reply('공지 채널이 설정되지 않았습니다.');
            }

            const noticeChannel = await interaction.guild.channels.fetch(noticeChannelId);

            if (!noticeChannel) {
                return await interaction.reply('저장된 공지 채널을 찾을 수 없습니다.');
            }

            await interaction.reply(`현재 설정된 공지 채널은 <#${noticeChannel.id}>입니다.`);
        } catch (error) {
            console.error('[❌ checknoticechannel 오류]', error);
            await interaction.reply('⚠️ 오류 발생: 공지 채널을 확인할 수 없습니다.');
        }
    }
};
