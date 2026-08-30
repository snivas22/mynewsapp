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

Notes:
- Respect source terms of use. This example uses public RSS feeds; confirm each publisher's usage policy.
- The site is configured for project Pages at https://snivas22.github.io/mynewsapp/
