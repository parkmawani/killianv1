const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('최근공지')
        .setDescription('마비노기 모바일 최신 공지를 불러옵니다.'),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.goto('https://mabinogimobile.nexon.com/News/Notice', {
                waitUntil: 'networkidle2',
            });

            await page.waitForSelector('ul.list > li.item');

            const notice = await page.$eval('ul.list > li.item', item => {
                const title = item.querySelector('a.title > span').textContent.trim();
                const threadId = item.querySelector('a.title').getAttribute('onclick').match(/link\((\d+),/)[1];
                const type = item.querySelector('div.order_1 > div.type > span').textContent.trim();
                const date = item.querySelector('div.order_2 > div.sub_info > div.date > span').textContent.trim();
                return { title, threadId, type, date };
            });

            const noticeUrl = `https://mabinogimobile.nexon.com/News/Notice/${notice.threadId}`;

            // 공지 유형별 이미지 설정
            const typeImages = {
                '안내': 'ano.png',
                '점검': 'close.png',
                '완료': 'close.png',
                '확인중인현상': 'check.png',
                '주요상품': 'store.png',
            };

            const imageFile = typeImages[notice.type] || 'default-image.png';
            const imagePath = path.join(__dirname, '..', 'images', imageFile);
            const imageAttachment = new AttachmentBuilder(imagePath);

            const embed = new EmbedBuilder()
                .setTitle(notice.title)
                .setURL(noticeUrl)
                .setColor(0x00bfff)
                .setImage(`attachment://${imageFile}`)

            await interaction.editReply({
                embeds: [embed],
                files: [imageAttachment],
            });

            await browser.close();
        } catch (err) {
            console.error('[❌ latestnotice 오류]', err);
            await interaction.editReply('⚠️ 공지를 불러오는 중 오류가 발생했습니다.');
        }
    },
};
