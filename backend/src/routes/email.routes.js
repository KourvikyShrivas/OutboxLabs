const express = require('express');
const controller = require('../controllers/email.controller');
const { validateBody } = require('../middleware/validate');
const { scheduleEmailSchema } = require('../utils/validation');

const router = express.Router();

router.post('/', validateBody(scheduleEmailSchema), controller.create); // schedule
router.get('/', controller.list); // list (optional ?status=)
router.get('/:id', controller.get); // inspect
router.delete('/:id', controller.cancel); // cancel

module.exports = router;
