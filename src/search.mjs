const query = process.argv.slice(2).join(" ").trim() || "product manager";
const location = process.env.JOBPILOT_LOCATION || "United Kingdom";
const remoteOnly = /^true$/i.test(process.env.JOBPILOT_REMOTE || "false");
const limit = Math.max(1, Number(process.env.JOBPILOT_LIMIT || 50));

const targetTerms = [
  "product manager", "senior product manager", "technical product manager",
  "digital product manager", "product owner", "senior product owner",
  "product lead", "head of product"
];

function text(v) {
  return String(v || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function canonicalUrl(value) {
  try {
    const u = new URL(value);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(k => u.searchParams.delete(k));
    return u.toString().replace(/\/$/, "");
  } catch { return String(value || ""); }
}

function normalise(j) {
  return {
    id: String(j.id || canonicalUrl(j.url) || [j.company,j.title,j.location].join("|")),
    title: text(j.title),
    company: text(j.company),
    location: text(j.location),
    remote: Boolean(j.remote) || /remote/i.test(j.location || ""),
    url: canonicalUrl(j.url),
    description: text(j.description),
    publishedAt: j.publishedAt || null,
    source: j.source || "unknown"
  };
}

function roleScore(job, q) {
  const hay = (job.title + " " + job.description.slice(0, 1500)).toLowerCase();
  const wanted = q.toLowerCase().split(/\s+/).filter(Boolean);
  let score = wanted.reduce((n, w) => n + (hay.includes(w) ? 8 : 0), 0);
  for (const term of targetTerms) if (job.title.toLowerCase().includes(term)) score += 25;
  if (/senior|lead|principal|head/i.test(job.title)) score += 8;
  if (/product/i.test(job.title)) score += 15;
  return score;
}

function eligible(job) {
  const hay = (job.location + " " + job.description.slice(0, 2500)).toLowerCase();
  if (remoteOnly && !job.remote) return false;
  const uk = /united kingdom|\buk\b|london|england|scotland|wales|northern ireland/.test(hay);
  const broadRemote = job.remote && !/us only|united states only|canada only|eu only|european union only/.test(hay);
  const locationRequested = location.toLowerCase();
  if (locationRequested.includes("united kingdom") || locationRequested === "uk") return uk || broadRemote;
  return hay.includes(locationRequested) || broadRemote;
}

async function getJson(url, options={}) {
  const r = await fetch(url, {headers: {"user-agent":"JobPilot/0.1"}, ...options});
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function arbeitnow() {
  const data = await getJson("https://www.arbeitnow.com/api/job-board-api");
  return (data.data || []).map(x => normalise({
    id:x.slug, title:x.title, company:x.company_name, location:x.location,
    remote:x.remote, url:x.url, description:x.description,
    publishedAt:x.created_at, source:"Arbeitnow"
  }));
}

async function remotive() {
  const data = await getJson("https://remotive.com/api/remote-jobs?search=" + encodeURIComponent(query));
  return (data.jobs || []).map(x => normalise({
    id:x.id, title:x.title, company:x.company_name,
    location:x.candidate_required_location || "Remote", remote:true,
    url:x.url, description:x.description, publishedAt:x.publication_date,
    source:"Remotive"
  }));
}

async function greenhouse(board) {
  const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`);
  return (data.jobs || []).map(x => normalise({
    id:`greenhouse:${board}:${x.id}`, title:x.title, company:board,
    location:x.location?.name, remote:/remote/i.test(x.location?.name || ""),
    url:x.absolute_url, description:x.content, publishedAt:x.updated_at,
    source:"Greenhouse"
  }));
}

async function lever(company) {
  const data = await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`);
  return (data || []).map(x => normalise({
    id:`lever:${company}:${x.id}`, title:x.text, company,
    location:x.categories?.location, remote:/remote/i.test(x.categories?.location || ""),
    url:x.hostedUrl, description:[x.descriptionPlain, x.additionalPlain].filter(Boolean).join("\n"),
    source:"Lever"
  }));
}

// Career Ops' useful idea is portal-first discovery. These are starter boards;
// JobPilot will move them to user configuration as we expand the UI.
const greenhouseBoards = ["openai","anthropic","figma","notion","stripe","airtable"];
const leverCompanies = ["monzo","wise","revolut"];

const tasks = [
  ["Arbeitnow", arbeitnow],
  ["Remotive", remotive],
  ...greenhouseBoards.map(b => [`Greenhouse:${b}`, () => greenhouse(b)]),
  ...leverCompanies.map(b => [`Lever:${b}`, () => lever(b)])
];

const settled = await Promise.allSettled(tasks.map(([,fn]) => fn()));
const jobs = [];
const errors = [];
settled.forEach((r,i) => r.status === "fulfilled" ? jobs.push(...r.value) : errors.push({source:tasks[i][0], error:r.reason?.message || String(r.reason)}));

const dedup = new Map();
for (const job of jobs) {
  const key = job.url || [job.company.toLowerCase(), job.title.toLowerCase(), job.location.toLowerCase()].join("|");
  if (!dedup.has(key)) dedup.set(key, job);
}

const results = [...dedup.values()]
  .filter(j => /product/i.test(j.title))
  .filter(eligible)
  .map(j => ({...j, score:roleScore(j, query)}))
  .sort((a,b) => b.score - a.score || String(b.publishedAt).localeCompare(String(a.publishedAt)))
  .slice(0, limit);

console.log(JSON.stringify({
  query, location, remoteOnly,
  searched: jobs.length,
  unique: dedup.size,
  matches: results.length,
  sourceErrors: errors,
  results
}, null, 2));
