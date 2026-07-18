News aggregator static site (Eleventy) with GitHub Actions publishing to GitHub Pages.

How it works:
- A scheduled GitHub Action installs Node, runs scripts/fetch_rss.js to fetch public RSS feeds (no news APIs), writes markdown into src/articles/{category}.
- Eleventy builds the static site into _site.
- The workflow deploys _site to GitHub Pages using actions-gh-pages.

Setup:
1. Push this repo to GitHub.
2. In Settings -> Pages, set the source to the gh-pages branch (the workflow will create it).
3. Optional: edit scripts/fetch_rss.js to add/remove RSS feeds or change limits.

Notes:
- Respect source terms of use. This example uses public RSS feeds; confirm each publisher's usage policy.
