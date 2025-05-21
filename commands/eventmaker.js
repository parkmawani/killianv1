const puppeteer = require('puppeteer');
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

function parseKoreanEventDate(dateStr) {
    // 예: "2025.5.15(목) 점검 후 ~ 2025.5.22(목) 오전 5시 59분까지"
    const regex = /(\d{4})\.(\d{1,2})\.(\d{1,2}).*~\s*(\d{4})\.(\d{1,2})\.(\d{1,2}).*/;
    const match = dateStr.replace(/\s/g, '').match(regex);
    if (!match) return { start: null, end: null };

    const [_, sYear, sMonth, sDay, eYear, eMonth, eDay] = match.map(Number);
    const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0);
    const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59);
    return { start, end };
}

async function fetchEvents() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('https://mabinogimobile.nexon.com/News/Events', {
        waitUntil: 'networkidle2',
        timeout: 60000,
    });

    const events = await page.$$eval('ul.list > li.item', items => {
        return items
            .filter(item => item.querySelector('div.type')?.textContent.trim() === '진행중')
            .map(item => {
                const id = item.getAttribute('data-threadid');
                const title = item.querySelector('div.descript div.order_1 a.title span').textContent.trim();
                const dateText = item.querySelector('div.descript div.order_2 div.date span').textContent.trim();
                const image = item.querySelector('div.thumbnail img')?.src || null;
                const link = `https://mabinogimobile.nexon.com/News/Events/${id}`;
                return { id, title, dateText, image, link };
            });
    });

    await browser.close();

    return events.map(event => {
        const { start, end } = parseKoreanEventDate(event.dateText);
        return { ...event, start, end };
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('이벤트생성')
        .setDescription('진행중인 이벤트 목록을 불러와 선택할 수 있습니다.'),

    async execute(interaction) {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({ content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.', ephemeral: true });
        }

        await interaction.deferReply();

        let events;
        try {
            events = await fetchEvents();
        } catch (error) {
            console.error('이벤트 크롤링 실패:', error);
            return interaction.editReply('❌ 이벤트 정보를 불러오는데 실패했습니다.');
        }

        if (events.length === 0) {
            return interaction.editReply('현재 진행중인 이벤트가 없습니다.');
        }

        // SelectMenu 만들기 (최대 25개)
        const options = events.slice(0, 25).map(event => ({
            label: event.title.length > 100 ? event.title.slice(0, 97) + '...' : event.title,
            description: event.dateText.length > 100 ? event.dateText.slice(0, 97) + '...' : event.dateText,
            value: event.id,
        }));

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_event')
                .setPlaceholder('이벤트를 선택하세요')
                .addOptions(options),
        );

        await interaction.editReply({ content: '아래에서 이벤트를 선택하세요.', components: [row], flags: MessageFlags.Ephemeral });
    },

    async handleSelect(interaction) {
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId !== 'select_event') return;

        await interaction.deferReply({ ephemeral: true });

        // 다시 fetch 해서 선택된 이벤트 찾기
        let events;
        try {
            events = await fetchEvents();
        } catch (error) {
            console.error('이벤트 크롤링 실패:', error);
            return interaction.editReply('❌ 이벤트 정보를 불러오는데 실패했습니다.');
        }

        const selectedId = interaction.values[0];
        const event = events.find(e => e.id === selectedId);

        if (!event) {
            return interaction.editReply('❌ 선택한 이벤트 정보를 찾을 수 없습니다.');
        }

        // 현재시간보다 시작시간이 이전이면 시작시간을 1분 후로 조정
        let startTime = event.start || new Date();
        if (startTime < new Date()) {
            startTime = new Date(Date.now() + 60000);
        }

        // 끝나는 시간이 없으면 시작시간 + 1시간으로 설정
        const endTime = event.end || new Date(startTime.getTime() + 3600000);

        try {
            const scheduledEvent = await interaction.guild.scheduledEvents.create({
                name: event.title,
                privacyLevel: 2, // GUILD_ONLY
                scheduledStartTime: startTime,
                scheduledEndTime: endTime,
                description: event.dateText,
                entityType: 3, // EXTERNAL
                entityMetadata: {
                    location: event.link,
                },
                image: event.image ? event.image : null,
            });

            await interaction.editReply({
                  content: `✅ 이벤트가 생성되었습니다. **[${scheduledEvent.name}](https://discord.com/events/${interaction.guild.id}/${scheduledEvent.id})**`
            });
        } catch (error) {
            console.error('[❌ 이벤트 생성 오류]', error);
            await interaction.editReply('❌ 이벤트 생성 중 오류가 발생했습니다.');
        }
    }
};
