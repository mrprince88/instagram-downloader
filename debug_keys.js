const puppeteer = require('puppeteer');

async function debugKeys() {
    const url = "https://www.instagram.com/p/DRE7LxHkyDt";
    console.log(`Testing URL: ${url}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

        await page.goto(url, { waitUntil: "networkidle2" });
        await new Promise(r => setTimeout(r, 3000));

        const data = await page.evaluate(() => {
            const shortcode = "DRE7LxHkyDt";
            const scripts = Array.from(document.querySelectorAll('script'));

            // 1. Find shortcode script and extract media_id
            let mediaId = null;
            let shortcodeScript = scripts.find(s => s.innerText.includes(shortcode));

            if (shortcodeScript) {
                // Try to match media_id (digits) near shortcode? 
                // Or looking for "media_id":"..."
                const mId = shortcodeScript.innerText.match(/"media_id":"(\d+)"/);
                if (mId) mediaId = mId[1];
            }

            // 2. Find script containing media_id (if found) or Shortcode that ALSO has media keys
            let targetScriptIndex = -1;
            let targetScriptHasVideo = false;
            let targetScriptHasImage = false;
            let targetScriptContext = "";

            // Search for the script that has the DATA (media_id + video_versions)
            // If mediaId is null, fallback to searching for shortcode + video_versions

            const identifier = mediaId || shortcode;

            scripts.forEach((s, idx) => {
                const txt = s.innerText;
                if (txt.includes(identifier)) {
                    // Check for media keys
                    if (txt.includes('"video_versions":') || txt.includes('"image_versions2":')) {
                        targetScriptIndex = idx;
                        targetScriptHasVideo = txt.includes('"video_versions":');
                        targetScriptHasImage = txt.includes('"image_versions2":');
                        targetScriptContext = txt.substring(0, 500) + "...";
                    }
                }
            });

            // Check global items context
            let itemsContext = "";
            if (document.body.innerHTML.includes('"items":[')) {
                const idx = document.body.innerHTML.indexOf('"items":[');
                itemsContext = document.body.innerHTML.substring(idx, idx + 200);
            }

            return {
                shortcode,
                foundMediaId: mediaId,
                targetScriptIndex,
                targetScriptHasVideo,
                targetScriptHasImage,
                itemsContext
            };
        });

        console.log("Key Check Results:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}

debugKeys();
