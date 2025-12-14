const puppeteer = require('puppeteer');

async function debugImage() {
    const url = "https://www.instagram.com/p/DSPfXVSE5fE";
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

        console.log("Navigating to page...");
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
        console.log("Page loaded.");

        await new Promise(r => setTimeout(r, 5000));

        const data = await page.evaluate(() => {
            const html = document.body.innerHTML;

            // Fallback search for any image-like structure
            const widthMatches = html.match(/"width":\d+,"height":\d+/g);

            // Grab a chunk of text around the first "width" match to see the context
            let snippet = "";
            const idx = html.indexOf('"width":');
            if (idx !== -1) {
                snippet = html.substring(idx - 200, idx + 500);
            }

            return {
                widthMatchesCount: widthMatches ? widthMatches.length : 0,
                snippet: snippet
            };
        });

        console.log("Debug Data:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}

debugImage();
