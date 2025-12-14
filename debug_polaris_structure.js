const puppeteer = require('puppeteer');

async function debugPolarisStructure() {
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
            const code = "DRE7LxHkyDt";
            const scripts = Array.from(document.querySelectorAll('script'));

            let targetScript = null;

            for (const s of scripts) {
                if (s.innerText.includes(code) && (s.innerText.includes('edge_sidecar_to_children') || s.innerText.includes('carousel_media'))) {
                    targetScript = s.innerText;
                    break;
                }
            }

            if (!targetScript) {
                // Fallback: finding any script with code and items
                for (const s of scripts) {
                    if (s.innerText.includes(code) && s.innerText.includes('"items":[')) {
                        targetScript = s.innerText;
                        break;
                    }
                }
            }

            if (!targetScript) return { error: "No target script found" };

            // Count occurrences and dump context
            const imgVerMatches = [...targetScript.matchAll(/"image_versions2":/g)];
            const videoVerMatches = [...targetScript.matchAll(/"video_versions":/g)];

            const imgContexts = imgVerMatches.map(m => targetScript.substring(m.index, m.index + 300));
            const videoContexts = videoVerMatches.map(m => targetScript.substring(m.index, m.index + 300));

            return {
                scriptLength: targetScript.length,
                imgVerCount: imgVerMatches.length,
                videoVerCount: videoVerMatches.length,
                imgContexts,
                videoContexts
            };
        });

        console.log("Debug Results:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}

debugPolarisStructure();
