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
                // Use Regex to find "items" : [ with optional whitespace
                const itemsKeyRegex = /"items"\s*:\s*\[/;
                const itemsKeyMatch = targetScriptContent.match(itemsKeyRegex);

                if (itemsKeyMatch) {
                    try {
                        const itemsStartIndex = itemsKeyMatch.index;
                        // We found where "items" starts. Now find the opening bracket '['
                        // The regex matched up to [ so the bracket is at match.index + match[0].length - 1

                        // Let's simply search for [ starting from itemsStartIndex
                        const arrayStart = targetScriptContent.indexOf('[', itemsStartIndex);

                        if (arrayStart !== -1) {
                            let depth = 0;
                            let end = -1;
                            let inStr = false;

                            for (let i = arrayStart; i < targetScriptContent.length; i++) {
                                if (targetScriptContent[i] === '\\' && inStr) { i++; continue; }
                                if (targetScriptContent[i] === '"') { inStr = !inStr; }
                                if (!inStr) {
                                    if (targetScriptContent[i] === '[') depth++;
                                    if (targetScriptContent[i] === ']') {
                                        depth--;
                                        if (depth === 0) {
                                            end = i + 1;
                                            break;
                                        }
                                    }
                                }
                            }

                            if (end !== -1) {
                                const itemsJson = targetScriptContent.substring(arrayStart, end);
                                const items = JSON.parse(itemsJson);

                                const processItem = (item) => {
                                    if (item.video_versions && item.video_versions.length > 0) {
                                        // It's a video!
                                        mediaItems.push({
                                            type: 'video',
                                            url: item.video_versions[0].url,
                                            thumbnail: item.image_versions2?.candidates?.[0]?.url
                                        });
                                        // DO NOT Add image (thumbnail)
                                    } else if (item.carousel_media) {
                                        item.carousel_media.forEach(processItem);
                                    } else if (item.image_versions2 && item.image_versions2.candidates) {
                                        const best = item.image_versions2.candidates.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
                                        if (best) {
                                            mediaItems.push({ type: 'image', url: best.url });
                                        }
                                    }
                                };

                                items.forEach(processItem);

                                // If we successfully parsed items, return them!
                                if (mediaItems.length > 0) {
                                    return mediaItems.slice(0, 10).map(m => ({
                                        type: m.type,
                                        url: m.url,
                                        thumbnail: m.thumbnail
                                    }));
                                }
                            }
                        }
                    } catch (e) {
                        console.error("JSON Parse Error (Fallback to Regex):", e);
                    }
                }

                // Global Scan on the Target Script (FALLBACK)
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
                // Note: This regex might pick up video thumbnails if the previous JSON parse failed!
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

            return mediaItems.slice(0, 10).map(m => ({ type: m.type, url: m.url, thumbnail: m.thumbnail }));
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
