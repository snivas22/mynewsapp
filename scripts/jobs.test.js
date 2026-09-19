const test = require('node:test');
const assert = require('node:assert/strict');

const {
  JOB_BOARD_SOURCES,
  ATS_BOARDS,
  ATS_SOURCES,
  ALL_JOB_SOURCES,
  JOB_BOARD_IDS,
  SEARCHABLE_JOB_SOURCES,
  GENERAL_JOB_SOURCES,
  isSourceAvailable,
  resolveJobSources,
  matchableText,
  matchesJobTerms,
  jobBoardFromSourceLabel,
  normalizeJobPosting,
  normalizeRssJobPosting
} = require('./lib/jobs');

const RUN_DATE = '2026-09-19T00:00:00.000Z';
const FAKE_ENV = { ADZUNA_APP_ID: 'id', ADZUNA_APP_KEY: 'key', JOOBLE_API_KEY: 'key' };

test('job source ids are unique and split into searchable and general', () => {
  assert.equal(new Set(JOB_BOARD_IDS).size, JOB_BOARD_IDS.length);
  assert.equal(SEARCHABLE_JOB_SOURCES.length + GENERAL_JOB_SOURCES.length, ALL_JOB_SOURCES.length);

  for (const source of SEARCHABLE_JOB_SOURCES) {
    assert.match(source.url('java', FAKE_ENV), /^https:\/\//);
  }
  for (const source of GENERAL_JOB_SOURCES) {
    assert.match(source.url(undefined, FAKE_ENV), /^https:\/\//);
  }
});

test('only sources with a working keyword query are searchable', () => {
  // Remotive's `search`, Remote OK's `tag` and Arbeitnow's `search` all return
  // unfiltered lists, so they stay in the general (locally filtered) set.
  const searchableIds = SEARCHABLE_JOB_SOURCES.map((source) => source.id).sort();
  assert.deepEqual(searchableIds, ['adzuna', 'jobicy', 'jooble']);

  const generalIds = GENERAL_JOB_SOURCES.map((source) => source.id);
  for (const id of ['himalayas', 'remoteok', 'remotive', 'themuse', 'weworkremotely']) {
    assert.equal(generalIds.includes(id), true, `${id} must be polled as a general source`);
  }
});

test('company applicant-tracking boards are polled as general sources', () => {
  const atsTypes = [...new Set(ATS_BOARDS.map((board) => board.ats))].sort();
  assert.deepEqual(atsTypes, ['ashby', 'greenhouse', 'lever']);
  assert.equal(ATS_SOURCES.length, ATS_BOARDS.length);

  for (const source of ATS_SOURCES) {
    assert.equal(source.searchable, false, `${source.id} must be filtered locally`);
    assert.match(source.url(undefined, FAKE_ENV), /^https:\/\//);
  }
});

test('key gated sources are skipped when the environment has no key', () => {
  const withoutKeys = resolveJobSources(ALL_JOB_SOURCES, {});
  assert.deepEqual(withoutKeys.skipped.map((source) => source.id).sort(), ['adzuna', 'jooble']);
  assert.equal(withoutKeys.available.some((source) => source.id === 'jobicy'), true);

  const withKeys = resolveJobSources(ALL_JOB_SOURCES, FAKE_ENV);
  assert.deepEqual(withKeys.skipped, []);

  assert.equal(isSourceAvailable({ id: 'plain' }, {}), true);
  assert.equal(isSourceAvailable({ id: 'gated', requiresEnv: ['A', 'B'] }, { A: '1' }), false);
  assert.equal(isSourceAvailable({ id: 'gated', requiresEnv: ['A', 'B'] }, { A: '1', B: '2' }), true);
});

test('no source targets a site that blocks scraping', () => {
  // Indeed, LinkedIn, Naukri and Glassdoor publish no public jobs feed and
  // forbid scraping, so no source may point at them.
  const forbidden = /naukri|indeed|linkedin|glassdoor|monster/i;

  for (const source of ALL_JOB_SOURCES) {
    assert.equal(
      forbidden.test(source.url('java', FAKE_ENV)),
      false,
      `${source.id} must not target a scraping-blocked site`
    );
  }
});

test('jobBoardFromSourceLabel recognizes archived postings', () => {
  assert.equal(jobBoardFromSourceLabel('Jobicy • Acme'), 'jobicy');
  assert.equal(jobBoardFromSourceLabel('Himalayas'), 'himalayas');
  assert.equal(jobBoardFromSourceLabel('We Work Remotely • Legion'), 'weworkremotely');
  assert.equal(jobBoardFromSourceLabel('Remote OK • Arango'), 'remoteok');
  assert.equal(jobBoardFromSourceLabel('Remotive • Zuora'), 'remotive');
  assert.equal(jobBoardFromSourceLabel('Adzuna • Infosys'), 'adzuna');
  assert.equal(jobBoardFromSourceLabel('Jooble • TCS'), 'jooble');
  assert.equal(jobBoardFromSourceLabel('The Muse • Stripe'), 'themuse');
  assert.equal(jobBoardFromSourceLabel('GitLab careers'), 'greenhouse-gitlab');
  assert.equal(jobBoardFromSourceLabel('OpenAI careers'), 'ashby-openai');
  assert.equal(jobBoardFromSourceLabel('Spotify careers'), 'lever-spotify');

  assert.equal(jobBoardFromSourceLabel('"Java developer jobs" - Google News'), '');
  assert.equal(jobBoardFromSourceLabel('Technology | The Guardian'), '');
  assert.equal(jobBoardFromSourceLabel(''), '');
  assert.equal(jobBoardFromSourceLabel(undefined), '');
});

test('normalizeJobPosting maps Adzuna, Jooble and The Muse payloads', () => {
  const adzuna = normalizeJobPosting('adzuna', {
    title: 'Java Developer',
    redirect_url: 'https://www.adzuna.in/land/ad/1',
    created: '2026-09-15T10:00:00Z',
    company: { display_name: 'Infosys' },
    location: { display_name: 'Hyderabad, Telangana' },
    description: 'Build services'
  }, RUN_DATE);

  assert.equal(adzuna.title, 'Java Developer');
  assert.equal(adzuna.source, 'Adzuna • Infosys');
  assert.equal(adzuna.link, 'https://www.adzuna.in/land/ad/1');
  assert.match(adzuna.summary, /Hyderabad/);

  const jooble = normalizeJobPosting('jooble', {
    title: 'Full Stack Developer',
    link: 'https://jooble.org/jdp/1',
    company: 'TCS',
    updated: '2026-09-14T00:00:00.000Z',
    location: 'Bengaluru',
    snippet: 'React and Java'
  }, RUN_DATE);

  assert.equal(jooble.source, 'Jooble • TCS');
  assert.match(jooble.summary, /Bengaluru/);

  const muse = normalizeJobPosting('themuse', {
    name: 'Software Engineer',
    refs: { landing_page: 'https://www.themuse.com/jobs/1' },
    company: { name: 'Stripe' },
    locations: [{ name: 'Remote' }],
    publication_date: '2026-09-12T00:00:00.000Z',
    contents: '<p>Payments</p>'
  }, RUN_DATE);

  assert.equal(muse.title, 'Software Engineer');
  assert.equal(muse.source, 'The Muse • Stripe');
  assert.equal(muse.summary.includes('<'), false);
});

test('normalizeJobPosting maps the applicant-tracking vendors', () => {
  const greenhouse = normalizeJobPosting('greenhouse-gitlab', {
    title: 'Backend Engineer',
    absolute_url: 'https://boards.greenhouse.io/gitlab/jobs/1',
    updated_at: '2026-09-13T00:00:00.000Z',
    location: { name: 'Remote' }
  }, RUN_DATE);

  assert.equal(greenhouse.title, 'Backend Engineer');
  assert.equal(greenhouse.source, 'GitLab careers');

  const lever = normalizeJobPosting('lever-spotify', {
    text: 'Senior Java Engineer',
    hostedUrl: 'https://jobs.lever.co/spotify/1',
    createdAt: 1757000000000,
    categories: { location: 'Stockholm', team: 'Engineering', commitment: 'Full-time' }
  }, RUN_DATE);

  assert.equal(lever.title, 'Senior Java Engineer');
  assert.equal(lever.source, 'Spotify careers');
  assert.equal(Number.isNaN(new Date(lever.date).getTime()), false);
  assert.match(lever.summary, /Engineering/);

  const ashby = normalizeJobPosting('ashby-ramp', {
    title: 'Full Stack Engineer',
    jobUrl: 'https://jobs.ashbyhq.com/ramp/1',
    publishedAt: '2026-09-11T00:00:00.000Z',
    location: 'Remote',
    descriptionPlain: 'Build the product'
  }, RUN_DATE);

  assert.equal(ashby.source, 'Ramp careers');
  assert.match(ashby.summary, /Build the product/);

  assert.equal(normalizeJobPosting('ashby-nonexistent', { title: 'x', jobUrl: 'y' }, RUN_DATE), null);
});

test('matchesJobTerms survives hyphens, casing and multi-word terms', () => {
  assert.equal(matchesJobTerms('Full-Stack Developer', ['full stack']), true);
  assert.equal(matchesJobTerms('SENIOR JAVA ENGINEER', ['java']), true);
  assert.equal(matchesJobTerms('JavaDeveloper', ['java developer']), false, 'words must not be glued together');
  assert.equal(matchesJobTerms('Senior Data Scientist', ['java']), false);
  assert.equal(matchesJobTerms('', ['java']), false);
  assert.equal(matchesJobTerms('Java Developer', []), false);
  assert.equal(matchableText('Java/Spring-Boot  Developer'), 'java spring boot developer');
});

test('normalizeJobPosting skips the Remote OK legal notice', () => {
  const notice = { legal: 'Attribution required', last_updated: 1 };
  assert.equal(normalizeJobPosting('remoteok', notice, RUN_DATE), null);

  const posting = normalizeJobPosting('remoteok', {
    company: 'Arango',
    position: 'Golang Kubernetes Engineer',
    apply_url: 'https://remoteok.com/jobs/1',
    date: '2026-09-16T19:00:02+00:00',
    location: 'Remote',
    salary_min: 120000,
    salary_max: 160000,
    description: '<p>Build  things</p>'
  }, RUN_DATE);

  assert.equal(posting.title, 'Golang Kubernetes Engineer');
  assert.equal(posting.link, 'https://remoteok.com/jobs/1');
  assert.equal(posting.source, 'Remote OK • Arango');
  assert.equal(posting.date, '2026-09-16T19:00:02+00:00');
  assert.equal(posting.summary.includes('<'), false, 'summary must be stripped of HTML');
  assert.match(posting.summary, /Remote/);
});

test('normalizeJobPosting maps Remotive and Jobicy payloads', () => {
  const remotive = normalizeJobPosting('remotive', {
    title: 'Senior Java Engineer',
    company_name: 'Zuora',
    url: 'https://remotive.com/remote-jobs/1',
    publication_date: '2026-09-16T12:35:28',
    candidate_required_location: 'Europe',
    job_type: 'full_time',
    description: 'About Zuora'
  }, RUN_DATE);

  assert.equal(remotive.title, 'Senior Java Engineer');
  assert.equal(remotive.source, 'Remotive • Zuora');
  assert.equal(remotive.date, '2026-09-16T12:35:28');
  assert.match(remotive.summary, /Europe/);
  assert.match(remotive.summary, /full time/);

  const jobicy = normalizeJobPosting('jobicy', {
    jobTitle: 'Java Developer',
    companyName: 'Acme',
    url: 'https://jobicy.com/jobs/1',
    pubDate: '2026-09-04T13:33:04+00:00',
    jobGeo: 'USA',
    jobExcerpt: 'Great role'
  }, RUN_DATE);

  assert.equal(jobicy.title, 'Java Developer');
  assert.equal(jobicy.source, 'Jobicy • Acme');
  assert.match(jobicy.summary, /USA/);
});

test('normalizeJobPosting falls back to the run date and rejects unusable rows', () => {
  const undated = normalizeJobPosting('remotive', {
    title: 'Java Developer',
    url: 'https://remotive.com/remote-jobs/2'
  }, RUN_DATE);

  assert.equal(undated.date, RUN_DATE);

  assert.equal(normalizeJobPosting('remotive', { title: '', url: 'https://x.dev' }, RUN_DATE), null);
  assert.equal(normalizeJobPosting('remotive', { title: 'No link' }, RUN_DATE), null);
  assert.equal(normalizeJobPosting('unknown-source', { title: 'x', url: 'y' }, RUN_DATE), null);
});

test('normalizeRssJobPosting splits the We Work Remotely company prefix', () => {
  const posting = normalizeRssJobPosting('weworkremotely', {
    title: 'Legion: Chief Architect',
    link: 'https://weworkremotely.com/remote-jobs/legion-chief-architect',
    pubDate: 'Mon, 07 Sep 2026 07:30:47 +0000',
    contentSnippet: 'Lead the platform team'
  }, RUN_DATE);

  assert.equal(posting.title, 'Chief Architect');
  assert.equal(posting.source, 'We Work Remotely • Legion');
  assert.equal(posting.link, 'https://weworkremotely.com/remote-jobs/legion-chief-architect');

  const plain = normalizeRssJobPosting('himalayas', {
    title: 'Java Engineer',
    link: 'https://himalayas.app/jobs/1',
    pubDate: 'Tue, 08 Sep 2026 00:00:00 +0000'
  }, RUN_DATE);

  assert.equal(plain.title, 'Java Engineer');
  assert.equal(plain.source, 'Himalayas');
  assert.equal(plain.date, 'Tue, 08 Sep 2026 00:00:00 +0000');
});

test('summaries are bounded and never empty', () => {
  const long = normalizeJobPosting('remotive', {
    title: 'Java Developer',
    url: 'https://remotive.com/remote-jobs/3',
    description: 'x'.repeat(2000)
  }, RUN_DATE);

  assert.equal(long.summary.length <= 280, true);

  const empty = normalizeJobPosting('remotive', {
    title: 'Java Developer',
    url: 'https://remotive.com/remote-jobs/4'
  }, RUN_DATE);

  assert.equal(empty.summary, 'No summary available.');
});
