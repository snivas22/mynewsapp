const test = require('node:test');
const assert = require('node:assert/strict');

const {
  JOB_BOARD_SOURCES,
  JOB_BOARD_IDS,
  SEARCHABLE_JOB_SOURCES,
  GENERAL_JOB_SOURCES,
  matchableText,
  matchesJobTerms,
  jobBoardFromSourceLabel,
  normalizeJobPosting,
  normalizeRssJobPosting
} = require('./lib/jobs');

const RUN_DATE = '2026-09-19T00:00:00.000Z';

test('job source ids are unique and split into searchable and general', () => {
  assert.equal(new Set(JOB_BOARD_IDS).size, JOB_BOARD_IDS.length);
  assert.equal(SEARCHABLE_JOB_SOURCES.length + GENERAL_JOB_SOURCES.length, JOB_BOARD_SOURCES.length);

  for (const source of SEARCHABLE_JOB_SOURCES) {
    assert.match(source.url('java'), /^https:\/\//);
  }
  for (const source of GENERAL_JOB_SOURCES) {
    assert.match(source.url(), /^https:\/\//);
  }
});

test('only sources with a working keyword query are searchable', () => {
  // Remotive's `search`, Remote OK's `tag` and Arbeitnow's `search` all return
  // unfiltered lists, so they must stay in the general (locally filtered) set.
  const searchableIds = SEARCHABLE_JOB_SOURCES.map((source) => source.id).sort();
  assert.deepEqual(searchableIds, ['jobicy']);

  const generalIds = GENERAL_JOB_SOURCES.map((source) => source.id).sort();
  assert.deepEqual(generalIds, ['himalayas', 'remoteok', 'remotive', 'weworkremotely']);
});

test('jobBoardFromSourceLabel recognizes archived postings', () => {
  assert.equal(jobBoardFromSourceLabel('Jobicy • Acme'), 'jobicy');
  assert.equal(jobBoardFromSourceLabel('Himalayas'), 'himalayas');
  assert.equal(jobBoardFromSourceLabel('We Work Remotely • Legion'), 'weworkremotely');
  assert.equal(jobBoardFromSourceLabel('Remote OK • Arango'), 'remoteok');
  assert.equal(jobBoardFromSourceLabel('Remotive • Zuora'), 'remotive');

  assert.equal(jobBoardFromSourceLabel('"Java developer jobs" - Google News'), '');
  assert.equal(jobBoardFromSourceLabel('Technology | The Guardian'), '');
  assert.equal(jobBoardFromSourceLabel(''), '');
  assert.equal(jobBoardFromSourceLabel(undefined), '');
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
