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

const seenFilePath = path.join(__dirname, 'seen_notices.txt');

// 제목 기준 중복 확인 (텍스트 파일 기준)
function hasSeenNotice(title) {
    if (!fs.existsSync(seenFilePath)) return false;
    const seenTitles = fs.readFileSync(seenFilePath, 'utf-8').split('\n').filter(Boolean);
    return seenTitles.includes(title);
}

// 제목 기록
function markNoticeAsSeen(title) {
    fs.appendFileSync(seenFilePath, `${title}\n`);
}

async function startNoticeWatcher(client) {
    setInterval(async () => {
        let browser;
        try {
            const channel = await client.channels.fetch(client.noticeChannelId);
            if (!channel) {
                console.log('❌ 공지 채널을 찾을 수 없습니다.');
                return;
            }

            // Puppeteer로 사이트 공지 10개 크롤링
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

            // 텍스트 파일에 기록된 제목만 중복 확인
            const newNotices = siteNotices.filter(
                (notice) => notice.title && !hasSeenNotice(notice.title)
            );

            // 타입별 이미지 매핑
            const typeImages = {
                안내: 'ano.png',
                점검: 'close.png',
                완료: 'close.png',
                확인중인현상: 'check.png',
                주요상품: 'store.png',
            };

            // 공지 순서 최신이 위로 오도록 배열 뒤집기
            for (const notice of newNotices.reverse()) {
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

                if (channel.type === 15) {
                    try {
                        await sentMessage.crosspost();
                        console.log(`📣 공지 발행 완료: ${notice.title}`);
                    } catch (error) {
                        console.warn(`❗ 공지 발행 실패: ${notice.title}`, error);
                    }
                }

                markNoticeAsSeen(notice.title);
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
    }, 30 * 1000); // 30초 간격
}

module.exports = { startNoticeWatcher };
