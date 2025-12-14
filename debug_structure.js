const puppeteer = require('puppeteer');

async function debugStructure() {
    const url = "https://www.instagram.com/p/DSPfXVSE5fE";
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
            const html = document.body.innerHTML;

            // Search for specific distinct keys that denote main post data
            const shortcodeMatch = html.match(/"shortcode_media":/);
            const graphqlMatch = html.match(/"graphql":/);
            const itemsMatch = html.match(/"items":\[/);

            let context = "";
            let matchType = "None";

            if (shortcodeMatch) {
                matchType = "shortcode_media";
                const idx = shortcodeMatch.index;
                context = html.substring(idx, idx + 1000); // Grab the start of the object
            } else if (graphqlMatch) {
                matchType = "graphql";
                const idx = graphqlMatch.index;
                context = html.substring(idx, idx + 1000);
            } else if (itemsMatch) {
                matchType = "items";
                const idx = itemsMatch.index;
                context = html.substring(idx, idx + 1000);
            }

            return {
                matchType,
                context
            };
        });

        console.log("Debug Results:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}

debugStructure();
