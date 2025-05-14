const fs = require('fs');
const path = require('path');
const { EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle} = require('discord.js');
const puppeteer = require('puppeteer');

async function startNoticeWatcher(client) {
    setInterval(async () => {
        try {
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.goto('https://mabinogimobile.nexon.com/News/Notice', {
                waitUntil: 'networkidle2',
            });

            // 공지 목록 가져오기
            await page.waitForSelector('ul.list > li.item');
            const notices = await page.$$eval('ul.list > li.item', items => {
                return items.map(item => {
                    const title = item.querySelector('a.title > span').textContent.trim();
                    const threadId = item.querySelector('a.title').getAttribute('onclick').match(/link\((\d+),/)[1];
                    const type = item.querySelector('div.order_1 > div.type > span').textContent.trim();
                    const date = item.querySelector('div.order_2 > div.sub_info > div.date > span').textContent.trim();
                    return { title, threadId, type, date };
                });
            });

            if (notices.length === 0) {
                console.log('새로운 공지가 없습니다.');
                await browser.close();
                return;
            }

            const latest = notices[0];

            // JSON 파일 경로
            // 상위 폴더로 가지 말고 현재 디렉토리에 생성
            const lastSentConfigPath = path.join(__dirname, 'last-sent.json');
            let lastSentConfig = {};

            // 파일 읽기
            let fileExists = fs.existsSync(lastSentConfigPath);
            if (fileExists) {
                try {
                    const raw = fs.readFileSync(lastSentConfigPath, 'utf-8');
                    console.log('[디버그] lastSentConfig 내용:', raw);
                    lastSentConfig = JSON.parse(raw);
                } catch (err) {
                    console.error('[❌ 공지 감시 오류] JSON 파싱 오류:', err);
                    lastSentConfig = {};
                }
            } else {
                console.log('[디버그] lastSentConfig 파일 없음. 첫 실행으로 간주합니다.');
            }

            const previousId = lastSentConfig.lastSentThreadId;
            console.log('[디버그] 이전 공지 ID:', previousId);
            console.log('[디버그] 최신 공지 ID:', latest.threadId);
            console.log('[디버그] 현재 lastSentConfigPath 경로:', lastSentConfigPath);


            // 이전 ID가 없거나 최신 ID와 다를 경우 전송
            if (!previousId || previousId !== latest.threadId) {
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
                    .setLabel('공지 확인') // 버튼 텍스트
                    .setURL(`https://mabinogimobile.nexon.com/News/Notice/${latest.threadId}`) // 버튼 URL
                    .setStyle(ButtonStyle.Link); // 버튼 스타일 (Link로 설정하여 URL 버튼으로 만듬)

                const row = new ActionRowBuilder().addComponents(button);



                const noticeChannelId = client.noticeChannelId;
                if (!noticeChannelId) {
                    console.log('공지 채널이 설정되지 않았습니다.');
                    await browser.close();
                    return;
                }

                const channel = await client.channels.fetch(noticeChannelId);
                if (!channel) {
                    console.log('공지 채널을 찾을 수 없습니다.');
                    await browser.close();
                    return;
                }

                await channel.send({ embeds: [embed], files: [imageAttachment], components: [row] });

                // 최신 ID 저장
                lastSentConfig.lastSentThreadId = latest.threadId;
                fs.writeFileSync(lastSentConfigPath, JSON.stringify(lastSentConfig, null, 2));
                console.log(`✅ 새 공지가 <#${noticeChannelId}>에 전송되었습니다.`);
            } else {
                console.log('새로운 공지가 없습니다. (같은 공지)');
            }

            await browser.close();
        } catch (error) {
            console.error('[❌ 공지 감시 오류]', error);
        }
    }, 30000);
}

module.exports = { startNoticeWatcher };
