News aggregator static site (Eleventy) with GitHub Actions publishing to GitHub Pages.

How it works:
- A scheduled GitHub Action installs Node, runs scripts/fetch_rss.js to fetch public RSS feeds, and writes markdown into src/articles/{category}.
- Eleventy builds the static site into _site.
- The workflow deploys the generated static site to GitHub Pages using the official GitHub Pages actions.

Setup:
1. Push this repo to GitHub.
2. In GitHub, open Settings -> Pages.
3. Set the Pages source to GitHub Actions.
4. Commit and push to the main branch; the workflow will build and deploy automatically.
5. Optional: edit scripts/fetch_rss.js to add/remove RSS feeds or change limits.

Local development:
- npm install
- npm run dev
- npm run build
- npm test

Job boards:
The daily briefing job sub-categories combine Google News search results with real
postings from public job-board APIs, merged by `scripts/fetch_rss.js`:

- No key needed: Jobicy, Remotive, Remote OK, We Work Remotely, Himalayas, The Muse,
  plus the GitLab, Databricks, Stripe, OpenAI, Ramp, Spotify and Toptal career boards.
- Optional keys (set as repository secrets, then as env vars in the workflow):
  - `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` - https://developer.adzuna.com
  - `JOOBLE_API_KEY` - https://jooble.org/api/about
  - optional `ADZUNA_COUNTRY` (default `in`)
  A source whose key is missing is skipped and reported in the fetch log.

Naukri, Indeed, Glassdoor and LinkedIn are deliberately not used: they publish no
public jobs feed and forbid scraping. Their listings are reached indirectly through
the aggregators above and through the companies' own applicant-tracking boards,
which is where a posting originates before it is syndicated.

Notes:
- Respect source terms of use. This example uses public RSS feeds; confirm each publisher's usage policy.
- The site is configured for project Pages at https://snivas22.github.io/mynewsapp/
