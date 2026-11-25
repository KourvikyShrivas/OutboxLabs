const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');

const create = asyncHandler(async (req, res) => {
  const job = await emailService.scheduleEmail(req.body);
  res.status(201).json({ data: job });
});

const list = asyncHandler(async (req, res) => {
  const jobs = await emailService.listEmails({ status: req.query.status });
  res.json({ data: jobs, count: jobs.length });
});

const get = asyncHandler(async (req, res) => {
  const job = await emailService.getEmail(req.params.id);
  res.json({ data: job });
});

const cancel = asyncHandler(async (req, res) => {
  const job = await emailService.cancelEmail(req.params.id);
  res.json({ data: job });
});

module.exports = { create, list, get, cancel };
