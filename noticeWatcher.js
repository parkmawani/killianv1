const fs = require('fs');
const path = require('path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');

async function startNoticeWatcher(client) {
    // 30초마다 공지 확인
    setInterval(async () => {
        try {
            // Puppeteer로 마비노기 모바일 공지 페이지를 크롤링
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

            // 공지가 없으면 종료
            if (notices.length === 0) {
                console.log('새로운 공지가 없습니다.');
                await browser.close();
                return;
            }

            // 가장 최신 공지 선택
            const latest = notices[0];

            // channel-config.json 파일 경로
            const channelConfigPath = path.join(__dirname, '..', 'channel-config.json');

            let channelConfig = {};
            // channel-config.json 파일이 존재하지 않거나 비어있으면 새로운 공지를 가져옴
            if (fs.existsSync(channelConfigPath)) {
                try {
                    channelConfig = JSON.parse(fs.readFileSync(channelConfigPath, 'utf-8'));
                } catch (err) {
                    console.error('[❌ 공지 감시 오류] JSON 파싱 오류:', err);
                    channelConfig = {}; // JSON 오류가 발생하면 기본값 사용
                }
            }

            // lastSentThreadId가 없으면 공지를 보내고, 있으면 비교 후 새 공지만 보냄
            if (channelConfig.lastSentThreadId !== latest.threadId) {
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

                // 임베드 생성
                const embed = new EmbedBuilder()
                    .setTitle(latest.title)
                    .setURL(`https://mabinogimobile.nexon.com/News/Notice/${latest.threadId}`)
                    .setImage(`attachment://${path.basename(imagePath)}`)
                    .setColor(0x00bfff);

                // 공지 채널로 전송
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

                // 공지 전송
                await channel.send({ embeds: [embed], files: [imageAttachment] });

                // 마지막으로 보낸 공지의 threadId를 저장
                channelConfig.lastSentThreadId = latest.threadId;
                fs.writeFileSync(channelConfigPath, JSON.stringify(channelConfig, null, 2));
                console.log(`새 공지가 <#${noticeChannelId}>에 전송되었습니다.`);
            } else {
                console.log('새로운 공지가 없습니다. (같은 공지)');
            }

            await browser.close();
        } catch (error) {
            console.error('[❌ 공지 감시 오류]', error);
        }
    }, 30000);  // 30초마다 공지 확인
}

module.exports = { startNoticeWatcher };
