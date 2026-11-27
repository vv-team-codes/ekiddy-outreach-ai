import * as cheerio from 'cheerio';
import { safeFetchPublicHtml, validateSafePublicUrl } from '../utils/urlSecurity.js';

export interface CrawledPage {
  url: string;
  title: string;
  textExcerpt: string;
  fetchedAt: Date;
}

export interface CrawlWebsiteResult {
  normalizedUrl: string;
  pages: CrawledPage[];
  combinedText: string;
  crawlWarning?: string;
}

export async function crawlCompanyWebsite(rawUrl: string): Promise<CrawlWebsiteResult> {
  const rootUrl = await validateSafePublicUrl(rawUrl);
  const pages: CrawledPage[] = [];
  let crawlWarning: string | undefined;

  const extractHtmlText = (html: string, url: string): { title: string; text: string; candidateLinks: string[] } => {
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, iframe').remove();

    const title = ($('title').text() || $('meta[property="og:title"]').attr('content') || url).trim();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

    const candidateLinks: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      if (/\/(about|pricing|product|products|service|services|solutions|customers)/i.test(href)) {
        try {
          const resolved = new URL(href, url);
          if (resolved.hostname === rootUrl.hostname) {
            candidateLinks.push(resolved.toString());
          }
        } catch {
          // Ignore malformed relative href
        }
      }
    });

    const uniqueLinks = Array.from(new Set(candidateLinks)).slice(0, 3);
    const fullText = [title, metaDesc, bodyText].filter(Boolean).join('\n');
    return { title, text: fullText.slice(0, 4000), candidateLinks: uniqueLinks };
  };

  try {
    const homeRes = await safeFetchPublicHtml(rootUrl.toString(), { timeoutMs: 7000 });
    const homeParsed = extractHtmlText(homeRes.body, homeRes.finalUrl);
    pages.push({
      url: homeRes.finalUrl,
      title: homeParsed.title,
      textExcerpt: homeParsed.text.slice(0, 1500),
      fetchedAt: new Date()
    });

    for (const subUrl of homeParsed.candidateLinks) {
      try {
        const subRes = await safeFetchPublicHtml(subUrl, { timeoutMs: 5000 });
        const subParsed = extractHtmlText(subRes.body, subRes.finalUrl);
        pages.push({
          url: subRes.finalUrl,
          title: subParsed.title,
          textExcerpt: subParsed.text.slice(0, 1500),
          fetchedAt: new Date()
        });
      } catch {
        // Subpage fetch failures should not abort primary research
      }
    }
  } catch (err) {
    crawlWarning =
      err instanceof Error
        ? `Live website fetch encountered a network restriction (${err.message}); continuing analysis from validated domain metadata.`
        : 'Live website fetch unavailable; continuing from validated domain metadata.';
  }

  const combinedText = pages.map((p) => `[${p.title}] (${p.url})\n${p.textExcerpt}`).join('\n\n');
  return {
    normalizedUrl: rootUrl.toString(),
    pages,
    combinedText,
    crawlWarning
  };
}
