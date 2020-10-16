const _ = require('lodash');
const express = require('express');
const { validateHeader, validateAuth } = require('../middlewares/headers');
const logger = require('../logger');
const queue = require('../queue');
const registry = require('../services/registry');

const router = express.Router();

router.post('/:lang_code',
  validateHeader('private'),
  validateAuth,
  async (req, res) => {
    try {
      const token = req.token.project_token;
      const key = `cache:${token}:${req.params.lang_code}:content`;
      const data = await registry.get(key);
      let count = 0;
      if (data) {
        const jobKey = key.replace('cache:', '');
        queue.addJob(jobKey, {
          type: 'syncer:pull',
          key: jobKey,
          token: req.token,
          syncFunc: 'getProjectLanguageTranslations',
          syncFuncParams: [req.params.lang_code],
        });
        count += 1;
      }
      res.json({
        status: 'success',
        token,
        count,
      });
    } catch (e) {
      logger.error(e);
      res.json({
        status: 'failed',
      });
    }
  });

router.post('/',
  validateHeader('private'),
  validateAuth,
  async (req, res) => {
    try {
      const token = req.token.project_token;
      const keys = await registry.find(`cache:${token}:*`);
      const contentRE = new RegExp(`cache:${token}:(.*):content`);
      let count = 0;
      _.each(keys, (key) => {
        const jobKey = key.replace('cache:', '');
        if (key === `cache:${token}:languages`) {
          queue.addJob(jobKey, {
            type: 'syncer:pull',
            key: jobKey,
            token: req.token,
            syncFunc: 'getLanguages',
            syncFuncParams: [],
          });
          count += 1;
        } else {
          const matches = key.match(contentRE);
          if (matches && matches[1]) {
            queue.addJob(jobKey, {
              type: 'syncer:pull',
              key: jobKey,
              token: req.token,
              syncFunc: 'getProjectLanguageTranslations',
              syncFuncParams: [matches[1]],
            });
            count += 1;
          }
        }
      });
      res.json({
        status: 'success',
        token,
        count,
      });
    } catch (e) {
      logger.error(e);
      res.json({
        status: 'failed',
      });
    }
  });

module.exports = router;
