const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const lastSentConfigPath = path.join(__dirname, 'last-sent.json');

async function startNoticeWatcher(client) {
    setInterval(async () => {
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.goto('https://mabinogimobile.nexon.com/News/Notice', { waitUntil: 'domcontentloaded' });

            const latest = await page.evaluate(() => {
                const notice = document.querySelector('.board_list tbody tr');
                const title = notice.querySelector('.tit a')?.textContent.trim();
                const href = notice.querySelector('.tit a')?.getAttribute('href');
                const date = notice.querySelector('.date')?.textContent.trim();
                const type = notice.querySelector('.sort')?.textContent.trim();
                const threadId = href?.split('/').pop();
                return { title, date, type, threadId };
            });

            console.log(`[디버그] 최신 공지 ID: ${latest.threadId}`);

            let lastSentConfig = {};
            if (fs.existsSync(lastSentConfigPath)) {
                try {
                    lastSentConfig = JSON.parse(fs.readFileSync(lastSentConfigPath, 'utf-8'));
                } catch (err) {
                    console.error('[❌ JSON 파싱 오류]', err);
                    lastSentConfig = {};
                }
            }

            const isChanged =
                lastSentConfig.lastSentThreadId !== latest.threadId ||
                lastSentConfig.lastSentTitle !== latest.title ||
                lastSentConfig.lastSentDate !== latest.date;

            if (isChanged) {
                const typeImages = {
                    '안내': './ano.png',
                    '점검': './close.png',
                    '완료': './close.png',
                    '확인중인현상': './check.png',
                    '주요상품': './store.png',
                };
                const imageFile = typeImages[latest.type] || 'default-image.png';
                const imagePath = path.join(__dirname, 'images', imageFile);
                const imageAttachment = new AttachmentBuilder(imagePath);

                const embed = new EmbedBuilder()
                    .setTitle(latest.title)
                    .setURL(`https://mabinogimobile.nexon.com/News/Notice/${latest.threadId}`)
                    .setImage(`attachment://${path.basename(imagePath)}`)
                    .setColor(0x00bfff);

                const button = new ButtonBuilder()
                    .setLabel('공지 보기')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://mabinogimobile.nexon.com/News/Notice/${latest.threadId}`);

                const row = new ActionRowBuilder().addComponents(button);

                const channel = await client.channels.fetch(client.noticeChannelId);
                if (!channel) {
                    console.log('❌ 공지 채널을 찾을 수 없습니다.');
                    await browser.close();
                    return;
                }

                await channel.send({
                    embeds: [embed],
                    components: [row],
                    files: [imageAttachment]
                });

                lastSentConfig = {
                    lastSentThreadId: latest.threadId,
                    lastSentTitle: latest.title,
                    lastSentDate: latest.date
                };
                fs.writeFileSync(lastSentConfigPath, JSON.stringify(lastSentConfig, null, 2));
                console.log(`🔁 공지 변경 감지됨: ${latest.title}`);
            } else {
                console.log('✅ 새로운 공지 없음 (ID 및 내용 동일)');
            }

            await browser.close();
        } catch (error) {
            console.error('[❌ 공지 감시 오류]', error);
            if (browser) await browser.close();
        }
    }, 30 * 1000); // 1분 간격
}

module.exports = { startNoticeWatcher };
