const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('공지선택')
        .setDescription('마비노기 모바일 공지 목록에서 하나를 선택하여 보여줍니다.'),
    async execute(interaction) {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({ content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.', ephemeral: true });
        }
        await interaction.deferReply();

        try {
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.goto('https://mabinogimobile.nexon.com/News/Notice', {
                waitUntil: 'networkidle2',
            });

            // 공지 목록 크롤링
            await page.waitForSelector('ul.list > li.item');
            const notices = await page.$$eval('ul.list > li.item', items => {
                return items.slice(0, 10).map(item => {
                    const title = item.querySelector('a.title > span').textContent.trim();
                    const threadId = item.querySelector('a.title').getAttribute('onclick').match(/link\((\d+),/)[1];
                    const type = item.querySelector('div.order_1 > div.type > span').textContent.trim();
                    const date = item.querySelector('div.order_2 > div.sub_info > div.date > span').textContent.trim();
                    return { title, threadId, type, date };
                });
            });

            await browser.close();

            // Select 메뉴 옵션 생성
            const options = notices.map(notice => ({
                label: notice.title.length > 50 ? notice.title.slice(0, 50) + '...' : notice.title,
                value: notice.threadId,
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_notice')
                .setPlaceholder('📢 공지를 선택하세요')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.editReply({
                content: '공지 중 하나를 선택해 주세요.',
                components: [row],
            });

            // 선택 대기
            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.customId === 'select_notice' && i.user.id === interaction.user.id,
                time: 30000,
            });

            collector.on('collect', async i => {
                await i.deferUpdate();

                const selected = notices.find(n => n.threadId === i.values[0]);

                const noticeUrl = `https://mabinogimobile.nexon.com/News/Notice/${selected.threadId}`;

                const typeImages = {
                    '안내': 'ano.png',
                    '점검': 'close.png',
                    '완료': 'close.png',
                    '확인중인현상': 'check.png',
                    '주요상품': 'store.png',
                };
                const imageFile = typeImages[selected.type] || 'default-image.png';
                const imagePath = path.join(__dirname, '..', 'images', imageFile);
                const attachment = new AttachmentBuilder(imagePath);

                const embed = new EmbedBuilder()
                    .setTitle(selected.title)
                    .setURL(noticeUrl)
                    .setImage(`attachment://${imageFile}`)
                    .setColor(0x00bfff)

                await interaction.editReply({
                    content: '',
                    embeds: [embed],
                    components: [],
                    files: [attachment],
                });

                collector.stop();
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({
                        content: '⏰ 시간이 초과되었습니다. 공지를 선택하지 않았습니다.',
                        components: [],
                    });
                }
            });
        } catch (error) {
            console.error('[❌ selectnotice 오류]', error);
            await interaction.editReply('⚠️ 공지를 불러오는 중 오류가 발생했습니다.');
        }
    },
};
