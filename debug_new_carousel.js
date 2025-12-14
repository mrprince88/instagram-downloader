const puppeteer = require('puppeteer');

async function debugNewCarousel() {
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

            let containingScript = null;
            let scriptPreview = "";

            for (const s of scripts) {
                if (s.innerText.includes(code)) {
                    containingScript = s.innerText;
                    // Find the index of the code and dump context
                    const idx = s.innerText.indexOf(code);
                    scriptPreview = s.innerText.substring(idx - 500, idx + 500);
                    break;
                }
            }

            // Check for items and carousel_media inside the found script or globally
            const itemsMatch = containingScript ? containingScript.match(/"items":\[/) : null;
            const carouselMatch = containingScript ? containingScript.match(/"carousel_media":\[/) : null;

            // Also check for edge_sidecar_to_children which is another way Graphql returns carousels
            const edgeSidecarMatch = document.body.innerHTML.match(/edge_sidecar_to_children/);

            return {
                scriptPreview: scriptPreview
            };
        });

        console.log("Debug Results:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}

debugNewCarousel();
