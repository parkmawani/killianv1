const { REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config(); // .env 파일에서 TOKEN, CLIENT_ID, GUILD_ID 가져옴

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('🔄 슬래시 명령어 등록 중...');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('✅ 슬래시 명령어 등록 완료!');
    } catch (error) {
        console.error(error);
    }
})();
