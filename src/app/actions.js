"use server";

import puppeteer from "puppeteer";

export async function fetchPostInfo(url) {
    if (!url) return { error: "URL is required" };

    let browser = null;

    try {
        if (!url.includes("instagram.com")) {
            return { error: "Please enter a valid Instagram URL" };
        }

        // Launch Puppeteer
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Set a realistic User-Agent
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );

        // Optimize scraping
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Go to the page and wait for network to be idle
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

        // Extract data from the DOM
        let result = await page.evaluate(() => {
            const ogImage = document.querySelector('meta[property="og:image"]')?.content;
            const ogVideo = document.querySelector('meta[property="og:video"]')?.content;

            let mediaItems = [];
            const seenUrls = new Set();

            const urlParts = window.location.pathname.split('/');
            const code = urlParts.find(p => p && p !== 'p' && p !== 'reel' && p !== 'tv' && p !== 'stories');

            // Find the specific script containing the POST DATA.
            // Rule: Must contain the Shortcode AND (items OR video_versions OR image_versions2)
            // This avoids Preloader scripts (which have code but no data) and Related Posts (which have data but different code/owner).

            const scripts = Array.from(document.querySelectorAll('script'));
            let targetScriptContent = "";

            for (const s of scripts) {
                const txt = s.innerText;
                if (txt.includes(code)) {
                    // Potential candidate, check for data keys
                    if (txt.includes('"items":[') || txt.includes('"video_versions":') || txt.includes('"image_versions2":')) {
                        // Check if it's NOT a preloader
                        if (!txt.includes('PolarisPostRootQuery') || txt.includes('"data":{')) {
                            targetScriptContent = txt;
                            break; // Found the best candidate
                        }
                    }
                }
            }

            // Fallback: If strict code match failed, try to find the "Main" item via items + media_id? 
            // Or just the legacy strategy of finding "items":[ ... ]
            if (!targetScriptContent) {
                const itemsMatchS = scripts.find(s => s.innerText.includes('"items":['));
                if (itemsMatchS) targetScriptContent = itemsMatchS.innerText;
            }

            // If still nothing, use body (risky but necessary fallback)
            if (!targetScriptContent) {
                targetScriptContent = document.body.innerHTML;
            }

            if (targetScriptContent) {
                // 1. Try to narrow down to the specific "items" block for this code if possible
                // "items":[{"code":"CODE" ... }]
                // Regex to capture the specific item block for this code?
                // It is safer to parse the whole script IF we are sure it's the right script.
                // Given we matched `code` + `data keys`, it's likely the right script.
                // But valid concern: Does this script ALSO contain "Related Posts"?
                // Usually Related Posts are loaded in a separate query/script.
                // If they are in the same script, they are usually structurally separate.
                // "items" usually contains ONLY the main post.

                // PRIORITY 1: Check for "items" block matching the code
                // This is the Gold Standard for accuracy (Step 339 logic)
                if (targetScriptContent.includes('"items":[')) {
                    const itemsRegex = /"items":\[(\{.*?\})\]/g;
                    // We need to iterate all item blocks? usually there is only one "items" array in the shim.
                    // But let's be careful.
                    // Let's use the Global Scan logic WITHIN this target script.
                    // But if the target script contains related items?
                    // Let's rely on the resolution filter + unique Set.
                }

                // Global Scan on the Target Script
                // 1. VIDEOS
                const vidRegex = /"video_versions":\[(.*?)\]/g;
                const vidMatches = [...targetScriptContent.matchAll(vidRegex)];
                vidMatches.forEach(m => {
                    const urlMatches = [...m[1].matchAll(/"url":"([^"]+)"/g)];
                    if (urlMatches.length > 0) {
                        const u = urlMatches[0][1].replace(/\\u0026/g, '&').replace(/\\/g, '');
                        if (!seenUrls.has(u)) {
                            mediaItems.push({ type: 'video', url: u, w: 0, h: 0 }); // We assume videos are high res
                            seenUrls.add(u);
                        }
                    }
                });

                // 2. IMAGES
                const imgRegex = /"image_versions2":\{"candidates":\[(.*?)\]\}/g;
                const imgMatches = [...targetScriptContent.matchAll(imgRegex)];
                imgMatches.forEach(m => {
                    const candidatesBlock = m[1];
                    const candCandidates = [];

                    // Robust parsing: Match individual objects { ... } assuming no nested braces (candidates are usually flat)
                    // or just split by "}," to be safe? 
                    // Regex \{[^{}]+\} matches simple flat objects.
                    const candidateObjs = candidatesBlock.match(/\{[^{}]+\}/g) || [];

                    for (const objStr of candidateObjs) {
                        try {
                            const wMatch = objStr.match(/"width":(\d+)/);
                            const hMatch = objStr.match(/"height":(\d+)/);
                            const urlMatch = objStr.match(/"url":"([^"]+)"/);

                            if (wMatch && hMatch && urlMatch) {
                                const w = parseInt(wMatch[1]);
                                const h = parseInt(hMatch[1]);
                                const rawUrl = urlMatch[1];
                                candCandidates.push({ w, h, url: rawUrl });
                            }
                        } catch (e) { }
                    }

                    if (candCandidates.length > 0) {
                        candCandidates.sort((a, b) => (b.w * b.h) - (a.w * a.h));
                        const best = candCandidates[0];
                        const cleanUrl = best.url.replace(/\\u0026/g, '&').replace(/\\/g, '');

                        // Filter: strictly high res to avoid thumbnails
                        if (best.w > 600 || best.h > 600) {
                            if (!seenUrls.has(cleanUrl)) {
                                mediaItems.push({ type: 'image', url: cleanUrl, w: best.w, h: best.h });
                                seenUrls.add(cleanUrl);
                            }
                        }
                    }
                });
            }

            // Return cleaned list (Max 10 items as requested)
            if (mediaItems.length === 0) {
                // Fallbacks
                if (ogVideo) mediaItems.push({ type: "video", url: ogVideo });
                else if (ogImage) mediaItems.push({ type: "image", url: ogImage });
            }

            return mediaItems.slice(0, 10).map(m => ({ type: m.type, url: m.url }));
        });

        if (!result || result.length === 0) {
            console.error("Puppeteer Extraction Failed. Page Title:", await page.title());
            return { error: "Could not extract media. The post might be private or login-walled." };
        }

        return { media: result };

    } catch (error) {
        console.error("Puppeteer Error:", error);
        return { error: "An error occurred while handling the request." };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
