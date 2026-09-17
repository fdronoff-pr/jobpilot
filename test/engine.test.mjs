import test from"node:test";import assert from"node:assert/strict";import{eligible,score,analyse,normalise}from"../src/lib.mjs";
test("normalises",()=>{const j=normalise({title:" Senior Product Manager ",company:"X",location:"London",url:"https://x.test/a?utm_source=z",description:"<p>Lead product.</p>"});assert.equal(j.title,"Senior Product Manager");assert.equal(j.url,"https://x.test/a")});
test("UK eligibility",()=>assert.equal(eligible({location:"London, UK",description:"",remote:false},"United Kingdom"),true));
test("role scoring",()=>assert.ok(score({title:"Senior Product Manager",description:"Own product strategy"},"product manager")>50));
test("blocker",()=>assert.equal(analyse({description:"Applicants must already have right to work. We cannot sponsor visas.",location:"London"}).blockers.length,1));
