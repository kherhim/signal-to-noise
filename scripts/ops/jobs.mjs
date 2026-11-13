/**
 * jobs.mjs — loads and validates the scheduled-job registry (ops/jobs.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const JOBS_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'ops', 'jobs.json');

const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function validateCadence(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return ['cadence must be an object'];
  const p = [];
  const kinds = ['daily', 'weekly', 'monthly', 'quarterly'];
  if (!kinds.includes(c.kind)) { p.push(`cadence.kind must be one of ${kinds.join(', ')}`); return p; }
  if (!int(c.hour_utc, 0, 23)) p.push('cadence.hour_utc must be an integer 0-23');
  if (c.minute !== undefined && !int(c.minute, 0, 59)) p.push('cadence.minute must be an integer 0-59');
  if (c.kind === 'weekly' && !int(c.weekday, 1, 7)) p.push('cadence.weekday must be an integer 1-7 (1 = Monday)');
  if ((c.kind === 'monthly' || c.kind === 'quarterly') && !int(c.day, 1, 28)) p.push('cadence.day must be an integer 1-28');
  if (c.kind === 'quarterly' && !(Array.isArray(c.months) && c.months.length > 0 && c.months.every((m) => int(m, 1, 12))))
    p.push('cadence.months must be a non-empty array of integers 1-12');
  return p;
}

function validateHeartbeat(job) {
  const h = job.heartbeat;
  if (!h || typeof h !== 'object' || Array.isArray(h)) return ['heartbeat must be an object'];
  const keys = Object.keys(h);
  if (keys.length !== 1 || !['workflow', 'variable'].includes(keys[0]))
    return ['heartbeat must have exactly one of workflow or variable'];
  const p = [];
  if (keys[0] === 'workflow') {
    if (typeof h.workflow !== 'string' || !/^[\w.-]+\.ya?ml$/.test(h.workflow)) p.push('heartbeat.workflow must be a .yml file name');
    if (job.runs_on !== 'actions') p.push('heartbeat.workflow requires runs_on "actions"');
  } else {
    if (typeof h.variable !== 'string' || !/^HEARTBEAT_[A-Z0-9]+(_[A-Z0-9]+)*$/.test(h.variable)) p.push('heartbeat.variable must match HEARTBEAT_UPPER_SNAKE');
    if (job.runs_on !== 'mac') p.push('heartbeat.variable requires runs_on "mac"');
  }
  return p;
}

export function validateJob(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) return ['job must be an object'];
  const p = [];
  if (typeof job.name !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(job.name)) p.push('name must be kebab-case');
  if (!['actions', 'mac'].includes(job.runs_on)) p.push('runs_on must be "actions" or "mac"');
  if (typeof job.since !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(job.since) || Number.isNaN(Date.parse(job.since))) p.push('since must be a YYYY-MM-DD date');
  if (typeof job.grace_hours !== 'number' || !(job.grace_hours > 0)) p.push('grace_hours must be a positive number');
  if (job.paused !== undefined && typeof job.paused !== 'boolean') p.push('paused must be a boolean');
  p.push(...validateCadence(job.cadence), ...validateHeartbeat(job));
  return p;
}

export function loadJobs(file = JOBS_FILE) {
  const jobs = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(jobs)) throw new Error(`${file}: top level must be an array of jobs`);
  const seen = new Set();
  jobs.forEach((job, i) => {
    const label = job && typeof job.name === 'string' ? job.name : `#${i}`;
    const problems = validateJob(job);
    if (problems.length) throw new Error(`job ${label}: ${problems.join('; ')}`);
    if (seen.has(job.name)) throw new Error(`duplicate job name ${job.name}`);
    seen.add(job.name);
  });
  return jobs;
}
