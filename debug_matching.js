const puppeteer = require('puppeteer');

async function debugMatching() {
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

        const data = await page.evaluate(() => {
            const ogImage = document.querySelector('meta[property="og:image"]')?.content;

            // Extract the "ID" from og:image
            // usually look for the segment like .../123456_7890123_... 
            // We'll try to find the longest digit sequence or the filename basic part
            let idMatch = "";
            if (ogImage) {
                // regex to capture the specific instagram filename format: 
                // e.g. 12345_67890_12345_n.jpg
                const match = ogImage.match(/(\d+_)+\d+_n/);
                if (match) {
                    idMatch = match[0];
                }
            }

            // Find all candidates
            const html = document.body.innerHTML;
            const imgObjRegex = /\{"height":\d+,"url":"[^"]+","width":\d+\}/g;
            const imgObjRegex2 = /\{"width":\d+,"height":\d+,"url":"[^"]+"\}/g;
            const imgObjRegex3 = /\{"url":"[^"]+","width":\d+,"height":\d+\}/g;

            const allMatches = [
                ...(html.match(imgObjRegex) || []),
                ...(html.match(imgObjRegex2) || []),
                ...(html.match(imgObjRegex3) || [])
            ];

            const candidates = [];
            for (const match of allMatches) {
                try {
                    const w = parseInt(match.match(/"width":(\d+)/)[1]);
                    const h = parseInt(match.match(/"height":(\d+)/)[1]);
                    const rawUrl = match.match(/"url":"([^"]+)"/)[1];
                    const url = rawUrl.replace(/\\u0026/g, '&').replace(/\\/g, '');
                    candidates.push({ w, h, url });
                } catch (e) { }
            }

            return {
                ogImage,
                idMatch,
                totalCandidates: candidates.length,
                // Return top 5 largest
                topCandidates: candidates.sort((a, b) => (b.w * b.h) - (a.w * a.h)).slice(0, 5),
                // Return matching candidates
                matchingCandidates: candidates.filter(c => idMatch && c.url.includes(idMatch))
            };
        });

        console.log("Debug Results:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await browser.close();
    }
}

debugMatching();
