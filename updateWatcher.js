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

const seenFilePath = path.join(__dirname, 'seen_updates.txt');

// 제목 기준 중복 확인 (텍스트 파일 기준)
function hasSeenUpdate(title) {
    if (!fs.existsSync(seenFilePath)) return false;
    const seenTitles = fs.readFileSync(seenFilePath, 'utf-8').split('\n').filter(Boolean);
    return seenTitles.includes(title);
}

// 제목 기록
function markUpdateAsSeen(title) {
    fs.appendFileSync(seenFilePath, `${title}\n`);
}

async function startUpdateWatcher(client) {
    setInterval(async () => {
        let browser;
        try {
            const channel = await client.channels.fetch(client.updateChannelId);
            if (!channel) {
                console.log('❌ 업데이트 채널을 찾을 수 없습니다.');
                return;
            }

            // 업데이트 페이지 크롤링
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.goto('https://mabinogimobile.nexon.com/News/Update', {
                waitUntil: 'domcontentloaded',
            });

            const siteUpdates = await page.evaluate(() => {
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

            if (!siteUpdates.length) {
                console.log('❌ 사이트 업데이트를 찾을 수 없습니다.');
                await browser.close();
                return;
            }

            // 텍스트 파일에 기록된 제목만 중복 확인
            const newUpdates = siteUpdates.filter(
                (update) => update.title && !hasSeenUpdate(update.title)
            );

            // 공지랑 같은 타입별 이미지 매핑
            const typeImages = {
                안내: 'ano.png',
                점검: 'close.png',
                완료: 'close.png',
                확인중인현상: 'check.png',
                주요상품: 'store.png',
            };

            // 업데이트 순서 최신이 위로 오도록 배열 뒤집기
            for (const update of newUpdates.reverse()) {
                const imageFile = typeImages[update.type] || 'update.png';
                const imagePath = path.join(__dirname, 'images', imageFile);
                const imageAttachment = new AttachmentBuilder(imagePath);

                const embed = new EmbedBuilder()
                    .setTitle(update.title)
                    .setURL(`https://mabinogimobile.nexon.com/News/Update/${update.threadId}`)
                    .setImage(`attachment://${path.basename(imagePath)}`)
                    .setColor(0xffa500);

                const button = new ButtonBuilder()
                    .setLabel('업데이트 보기')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://mabinogimobile.nexon.com/News/Update/${update.threadId}`);

                const row = new ActionRowBuilder().addComponents(button);

                await channel.send({
                    embeds: [embed],
                    components: [row],
                    files: [imageAttachment],
                });

                try {
                    await sentMessage.crosspost();
                    console.log(`📣 공지 발행 완료: ${notice.title}`);
                } catch (error) {
                    console.warn(`❗ 공지 발행 실패 (무시됨일 수 있음): ${notice.title}`, error.message);
                }

                markUpdateAsSeen(update.title);
                console.log(`📦 새 업데이트 전송됨: ${update.title}`);
            }

            if (newUpdates.length === 0) {
                console.log('✅ 새로운 업데이트 없음');
            }

            await browser.close();
        } catch (error) {
            console.log('업데이트 채널 ID:', client.updateChannelId);
            console.error('[❌ 업데이트 감시 오류]', error);
            if (browser) await browser.close();
        }
    }, 30 * 1000); // 30초 간격
}

module.exports = { startUpdateWatcher };
