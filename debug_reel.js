const puppeteer = require('puppeteer');

async function debugReel() {
    const url = "https://www.instagram.com/reel/DSO88IxkfCl";
    console.log(`Testing URL: ${url}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );

        const validTags = {
            videoUrls: []
        };

        console.log("Navigating to page...");
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
        console.log("Page loaded.");

        // Wait for hydration
        await new Promise(r => setTimeout(r, 5000));

        const debugData = await page.evaluate(() => {
            const html = document.body.innerHTML;
            const videoVersionsMatch = html.match(/"video_versions":\[.*?\]/);
            const videoUrlMatch = html.match(/"video_url":".*?"/g); // Get all occurrences

            return {
                foundVideoVersions: !!videoVersionsMatch,
                videoVersionsSnippet: videoVersionsMatch ? videoVersionsMatch[0].substring(0, 500) : "Not Found",
                videoUrlMatches: videoUrlMatch || []
            };
        });

        console.log("Debug Results:", JSON.stringify(debugData, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}

debugReel();
