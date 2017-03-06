'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const configureRequest = require('../util/configureRequest');
const syncDataset = require('../util/syncDataset');
const createRecord = require('../util/createRecord');
const promiseAct = require('../util/promiseAct');
const syncResultsToArray = require('../util/syncResultsToArray');
const makeResult = require('../util/fixtures/makeResult');
const makeMessage = require('../util/fixtures/makeMessage');
const randomstring = require('randomstring');

module.exports = function mobileFlow(runner, argv) {
  return function mobileFlowAct(previousResolution) {
    runner.actStart('Mobile Flow');

    const baseUrl = argv.app;
    const clientId = previousResolution.clientIdentifier;
    const request = configureRequest(clientId, previousResolution.sessionToken);
    const create = createRecord.bind(this, baseUrl, request, clientId);
    const doSync = syncDataset.bind(this, baseUrl, request, clientId);
    const datasets = ['workorders', 'workflows', 'messages', 'result'];
    const act = promiseAct.bind(this, runner);

    const initialSync = act('Device: initialSync',
      () => Promise.all(datasets.map(doSync)))
      .then(syncResultsToArray);

    return Promise.join(
      initialSync,
      request.get({
        url: `${baseUrl}/api/wfm/user`
      }),
      (data, users) => {
        const workorders = data[0];
        const user = _.find(users, {username: `loaduser${process.env.LR_RUN_NUMBER}`});

        return Promise.all([
          // create one result
          act('Device: create New Result', // TODO: creation of the object doesn't need to be measured
              () => makeResult(randomstring.generate(6), user.id, _.find(workorders, {assignee: user.id})))
            .then(result => act('Device: sync New result', () => create('results', result))) // create
            .then(result => act('Device: sync In Progress result', () => {})) // update
            .then(result => act('Device: sync Complete result', () => {})), // update
          // create one message // TODO: demo client app doesn't *SEND* any messages
          act('Device: create messages', () => makeMessage(user))
            .then(message => act('Device: sync messages', () => create('messages', message)))
        ]);
      })
      .then(() => runner.actEnd('Mobile Flow'))
      .then(() => previousResolution);
  };
};
