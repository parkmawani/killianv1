const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
} = require('discord.js');

async function startNoticeWatcher(client) {
    setInterval(async () => {
        let browser;
        try {
            const channel = await client.channels.fetch(client.noticeChannelId);
            if (!channel) {
                console.log('❌ 공지 채널을 찾을 수 없습니다.');
                return;
            }

            // 1) 디스코드 최근 10개 메시지에서 공지 제목들 수집
            const recentMessages = await channel.messages.fetch({ limit: 15 });
            const sentTitles = recentMessages
                .map((msg) => {
                    if (msg.embeds.length > 0) {
                        return msg.embeds[0].title;
                    }
                    return msg.content;
                })
                .filter(Boolean);

            // 2) Puppeteer로 사이트 공지 10개 크롤링
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.goto('https://mabinogimobile.nexon.com/News/Notice', {
                waitUntil: 'domcontentloaded',
            });

            const siteNotices = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('ul.list li.item')).slice(0, 10);
                return items.map((item) => {
                    const titleSpan = item.querySelector('.title span');
                    const typeSpan = item.querySelector('.type span');
                    const title = titleSpan ? titleSpan.textContent.trim() : null;
                    const type = typeSpan ? typeSpan.textContent.trim() : null;
                    const threadId = item.getAttribute('data-threadid');
                    return { title, type, threadId };
                });
            });

            if (!siteNotices.length) {
                console.log('❌ 사이트 공지를 찾을 수 없습니다.');
                await browser.close();
                return;
            }

            // 3) 디스코드에 없는 새 공지만 필터링
            const newNotices = siteNotices.filter(
                (notice) => notice.title && !sentTitles.includes(notice.title),
            );

            // 타입별 이미지 매핑 (파일 이름/경로는 실제 이미지 위치에 맞게 조정하세요)
            const typeImages = {
                안내: 'ano.png',
                점검: 'close.png',
                완료: 'close.png',
                확인중인현상: 'check.png',
                주요상품: 'store.png',
            };

            for (const notice of newNotices) {
                const imageFile = typeImages[notice.type] || 'default-image.png';
                const imagePath = path.join(__dirname, 'images', imageFile);
                const imageAttachment = new AttachmentBuilder(imagePath);

                const embed = new EmbedBuilder()
                    .setTitle(notice.title)
                    .setURL(`https://mabinogimobile.nexon.com/News/Notice/${notice.threadId}`)
                    .setImage(`attachment://${path.basename(imagePath)}`)
                    .setColor(0x00bfff);

                const button = new ButtonBuilder()
                    .setLabel('공지 보기')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://mabinogimobile.nexon.com/News/Notice/${notice.threadId}`);

                const row = new ActionRowBuilder().addComponents(button);

                await channel.send({
                    embeds: [embed],
                    components: [row],
                    files: [imageAttachment],
                });
                console.log(`🔔 새 공지 전송됨: ${notice.title}`);
            }

            if (newNotices.length === 0) {
                console.log('✅ 새로운 공지 없음');
            }

            await browser.close();
        } catch (error) {
            console.log('공지 채널 ID:', client.noticeChannelId);
            console.error('[❌ 공지 감시 오류]', error);
            if (browser) await browser.close();
        }
    }, 30 * 1000); // 1분 간격
}

module.exports = { startNoticeWatcher };
