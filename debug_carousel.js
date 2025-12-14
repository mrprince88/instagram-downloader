const puppeteer = require('puppeteer');

async function debugCarousel() {
    const url = "https://www.instagram.com/p/DSPfXVSE5fE"; // This URL might be single, let's assume user meant a carousel URL. 
    // If the user provided a specific carousel URL previously I would use it, but they just said "still getting only one".
    // I will stick to the previous URL for consistency, but checks logic applies to any post.

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

            // 1. Reproduce the bug
            const buggyRegex = /"items":\[(\{.*?\})\]/;
            const buggyMatch = html.match(buggyRegex);

            // 2. Fix: Find script containing the shortcode data
            // We look for a script that contains "items" and the shortcode
            const scripts = Array.from(document.querySelectorAll('script'));
            let targetScript = null;
            // Shortcode from URL: DSPfXVSE5fE
            const shortcode = "DSPfXVSE5fE";

            for (const s of scripts) {
                if (s.innerText.includes(`"code":"${shortcode}"`) && s.innerText.includes('"items":[')) {
                    targetScript = s.innerText;
                    break;
                }
            }

            return {
                buggyMatchLength: buggyMatch ? buggyMatch[1].length : 0,
                buggyMatchSnippet: buggyMatch ? buggyMatch[1].substring(0, 100) + "..." : "No match",
                fullScriptFound: !!targetScript,
                fullScriptLength: targetScript ? targetScript.length : 0,
                // Count occurrences in full script
                videoVersionsCount: targetScript ? (targetScript.match(/"video_versions":\[/g) || []).length : 0,
                imageVersionsCount: targetScript ? (targetScript.match(/"image_versions2":\{/g) || []).length : 0,
                carouselMediaCount: targetScript ? (targetScript.match(/"carousel_media":\[/g) || []).length : 0
            };
        });

        console.log("Debug Results:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}

debugCarousel();
