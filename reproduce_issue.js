const cheerio = require('cheerio');

async function testScrape() {
    const url = "https://www.instagram.com/p/C-4_2XZSlQT/?__a=1&__d=dis";
    // const url = "https://www.instagram.com/p/C-4_2XZSlQT/embed";
    console.log(`Testing URL: ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://www.google.com/"
            },
        });

        console.log(`Response Status: ${response.status}`);

        if (!response.ok) {
            console.error("Fetch failed");
            return;
        }

        const html = await response.text();
        console.log(`HTML Length: ${html.length}`);

        const $ = cheerio.load(html);

        console.log("Page Title:", $("title").text());

        const ogImage = $('meta[property="og:image"]').attr("content");
        const ogVideo = $('meta[property="og:video"]').attr("content");

        console.log("OG Image:", ogImage);
        console.log("OG Video:", ogVideo);

        if (!ogImage && !ogVideo) {
            console.log("Failed to extract OG tags. Page seems to be:", $("body").text().substring(0, 200).replace(/\s+/g, ' '));
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

testScrape();
