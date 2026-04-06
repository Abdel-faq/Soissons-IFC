const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cheerio = require('cheerio');

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

router.get('/results', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Check cache
    const cachedData = cache.get(url);
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
        return res.json(cachedData.data);
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch FFF page: ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const results = {
            lastMatch: null,
            upcomingMatches: [],
            teamName: $('h1').text().trim() || $('.title').first().text().trim() || 'Équipe'
        };

        // Parse matches from the page
        const allLinks = $('a');
        $('a[href*="/match/"]').each((i, el) => {
            const matchLinkIdx = allLinks.index(el);
            const matchLink = $(el);

            const matchData = {
                date: "",
                homeTeam: "",
                awayTeam: "",
                score: matchLink.text().trim(),
                competition: ""
            };

            // Pattern: [Comp] [Home] [Score/Match] [Away]
            const homeLink = allLinks.eq(matchLinkIdx - 1);
            const awayLink = allLinks.eq(matchLinkIdx + 1);
            const compLink = allLinks.eq(matchLinkIdx - 2);

            if (homeLink.length && awayLink.length) {
                matchData.homeTeam = homeLink.text().trim();
                matchData.awayTeam = awayLink.text().trim();
                matchData.competition = compLink.length ? compLink.text().trim() : "";

                // Try to find the date in the nearest parent text or sibling
                // FFF matches often have a date nearby in a .date class or similar
                const container = matchLink.closest('div, li, section');
                matchData.date = container.find('.date, .datetime, .time').first().text().trim();

                if (!matchData.date) {
                    // Look for any text that looks like a date (DD/MM or Journée)
                    const text = container.text();
                    const dateMatch = text.match(/\d{2}\/\d{2}/);
                    if (dateMatch) matchData.date = dateMatch[0];
                }

                results.upcomingMatches.push(matchData);
            }
        });

        // Split into lastMatch and upcomingMatches (heuristically)
        // Usually the first one is the last match if it has a score
        if (results.upcomingMatches.length > 0) {
            results.lastMatch = results.upcomingMatches.find(m => m.score && /\d/.test(m.score));
            // Keep them all in upcomingMatches for the calendar view too, but maybe filter out the primary one
        }

        // Cache and return
        cache.set(url, {
            timestamp: Date.now(),
            data: results
        });

        res.json(results);
    } catch (error) {
        console.error('FFF Scraping Error:', error);
        res.status(500).json({ error: 'Failed to parse FFF data', details: error.message });
    }
});

module.exports = router;
