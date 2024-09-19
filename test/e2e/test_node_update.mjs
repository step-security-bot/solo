/**
 * Copyright (C) 2024 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the ""License"");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an ""AS IS"" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @jest-environment steps
 */
import { flags } from '../../src/commands/index.mjs'
import { constants } from '../../src/core/index.mjs'
import {
  accountCreationShouldSucceed,
  balanceQueryShouldSucceed,
  bootstrapNetwork,
  getDefaultArgv, getNodeIdsPrivateKeysHash, getTmpDir,
  HEDERA_PLATFORM_VERSION_TAG
} from '../test_util.js'
import { getNodeLogs } from '../../src/core/helpers.mjs'
import { NodeCommand } from '../../src/commands/node.mjs'
import { HEDERA_HAPI_PATH, ROOT_CONTAINER } from '../../src/core/constants.mjs'
import fs from 'fs'

export function testNodeUpdate (namespacePostfix, hederaImage) {
  describe(`Node update [${namespacePostfix}]`, () => {
    const defaultTimeout = 120000
    const namespace = `node-update-${namespacePostfix}`
    const updateNodeId = 'node2'
    const newAccountId = '0.0.7'
    const argv = getDefaultArgv()
    argv[flags.hederaImage.name] = hederaImage
    argv[flags.nodeIDs.name] = 'node1,node2,node3'
    argv[flags.nodeID.name] = updateNodeId

    argv[flags.newAccountNumber.name] = newAccountId
    argv[flags.newAdminKey.name] = '302e020100300506032b6570042204200cde8d512569610f184b8b399e91e46899805c6171f7c2b8666d2a417bcc66c2'

    argv[flags.generateGossipKeys.name] = true
    argv[flags.generateTlsKeys.name] = true
    // set the env variable SOLO_FST_CHARTS_DIR if developer wants to use local FST charts
    argv[flags.chartDirectory.name] = process.env.SOLO_FST_CHARTS_DIR
      ? process.env.SOLO_FST_CHARTS_DIR
      : undefined
    argv[flags.releaseTag.name] = HEDERA_PLATFORM_VERSION_TAG
    argv[flags.namespace.name] = namespace
    argv[flags.persistentVolumeClaims.name] = true
    const bootstrapResp = bootstrapNetwork(namespace, argv)
    const nodeCmd = bootstrapResp.cmd.nodeCmd
    const accountCmd = bootstrapResp.cmd.accountCmd
    const k8 = bootstrapResp.opts.k8
    let existingServiceMap
    let existingNodeIdsPrivateKeysHash

    afterAll(async () => {
      await getNodeLogs(k8, namespace)
      await nodeCmd.accountManager.close()
      await nodeCmd.stop(argv)
      await k8.deleteNamespace(namespace)
    }, 600000)

    it('cache current version of private keys', async () => {
      existingServiceMap = await nodeCmd.accountManager.getNodeServiceMap(
        namespace)
      existingNodeIdsPrivateKeysHash = await getNodeIdsPrivateKeysHash(
        existingServiceMap, namespace, k8, getTmpDir())
    }, defaultTimeout)

    it('should succeed with init command', async () => {
      const status = await accountCmd.init(argv)
      expect(status).toBeTruthy()
    }, 450000)

    it('should update a new node property successfully', async () => {
      // generate gossip and tls keys for the updated node
      const tmpDir = getTmpDir()

      const signingKey = await nodeCmd.keyManager.generateSigningKey(
        updateNodeId)
      const signingKeyFiles = await nodeCmd.keyManager.storeSigningKey(
        updateNodeId, signingKey, tmpDir)
      nodeCmd.logger.debug(
          `generated test gossip signing keys for node ${updateNodeId} : ${signingKeyFiles.certificateFile}`)
      argv[flags.gossipPublicKey.name] = signingKeyFiles.certificateFile
      argv[flags.gossipPrivateKey.name] = signingKeyFiles.privateKeyFile

      const tlsKey = await nodeCmd.keyManager.generateGrpcTLSKey(updateNodeId)
      const tlsKeyFiles = await nodeCmd.keyManager.storeTLSKey(updateNodeId,
        tlsKey, tmpDir)
      nodeCmd.logger.debug(
          `generated test TLS keys for node ${updateNodeId} : ${tlsKeyFiles.certificateFile}`)
      argv[flags.tlsPublicKey.name] = tlsKeyFiles.certificateFile
      argv[flags.tlsPrivateKey.name] = tlsKeyFiles.privateKeyFile

      await nodeCmd.update(argv)
      const expectedUnusedConfigs = [
        flags.app.constName,
        flags.devMode.constName
      ]
      if (argv[flags.hederaImage.name]) {
        expectedUnusedConfigs.push(flags.localBuildPath.constName)
      }

      expect(nodeCmd.getUnusedConfigs(NodeCommand.UPDATE_CONFIGS_NAME)).toEqual(
        expectedUnusedConfigs)
      await nodeCmd.accountManager.close()
    }, 1800000)

    balanceQueryShouldSucceed(nodeCmd.accountManager, nodeCmd, namespace)

    accountCreationShouldSucceed(nodeCmd.accountManager, nodeCmd, namespace)

    it('signing key and tls key should not match previous one', async () => {
      const currentNodeIdsPrivateKeysHash = await getNodeIdsPrivateKeysHash(
        existingServiceMap, namespace, k8, getTmpDir())

      for (const [nodeId, existingKeyHashMap] of
        existingNodeIdsPrivateKeysHash.entries()) {
        const currentNodeKeyHashMap = currentNodeIdsPrivateKeysHash.get(nodeId)

        for (const [keyFileName, existingKeyHash] of
          existingKeyHashMap.entries()) {
          if (nodeId === updateNodeId &&
              (keyFileName.startsWith(constants.SIGNING_KEY_PREFIX) ||
                  keyFileName.startsWith(constants.AGREEMENT_KEY_PREFIX) ||
                  keyFileName.startsWith('hedera'))) {
            expect(`${nodeId}:${keyFileName}:${currentNodeKeyHashMap.get(
                keyFileName)}`).not.toEqual(
                `${nodeId}:${keyFileName}:${existingKeyHash}`)
          } else {
            expect(`${nodeId}:${keyFileName}:${currentNodeKeyHashMap.get(
                keyFileName)}`).toEqual(
                `${nodeId}:${keyFileName}:${existingKeyHash}`)
          }
        }
      }
    }, defaultTimeout)

    it('config.txt should be changed with new account id', async () => {
      // read config.txt file from first node, read config.txt line by line, it should not contain value of newAccountId
      const pods = await k8.getPodsByLabel(
        ['fullstack.hedera.com/type=network-node'])
      const podName = pods[0].metadata.name
      const tmpDir = getTmpDir()
      await k8.copyFrom(podName, ROOT_CONTAINER,
          `${HEDERA_HAPI_PATH}/config.txt`, tmpDir)
      const configTxt = fs.readFileSync(`${tmpDir}/config.txt`, 'utf8')
      console.log('config.txt:', configTxt)
      expect(configTxt).toContain(newAccountId)
    }, 600000)
  })
}