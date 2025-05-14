const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

const clientId = '1371275293766979675';  // 봇의 클라이언트 ID
const guildId = '919816386035994635';  // 서버의 ID
const token = 'MTM3MTI3NTI5Mzc2Njk3OTY3NQ.GgSvgH.4qP-ARRBZmfyfIy2X0t3ej_9MS8-kj-j-Y3xXU';  // 봇의 토큰

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
    try {
        console.log('Started deleting application (/) commands.');

        // 서버에 등록된 모든 슬래시 명령어를 가져와서 삭제합니다.
        const commands = await rest.get(Routes.applicationGuildCommands(clientId, guildId));

        for (const command of commands) {
            // 각 명령어를 삭제
            await rest.delete(Routes.applicationGuildCommand(clientId, guildId, command.id));
            console.log(`Successfully deleted command: ${command.name}`);
        }

        console.log('Successfully deleted all application (/) commands.');
    } catch (error) {
        console.error('Error deleting commands:', error);
    }
})();
