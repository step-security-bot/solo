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
import {
  accountCreationShouldSucceed,
  balanceQueryShouldSucceed,
  bootstrapNetwork,
  getDefaultArgv,
  HEDERA_PLATFORM_VERSION_TAG
} from '../test_util.js'
import { getNodeLogs, getTmpDir } from '../../src/core/helpers.mjs'
import { NodeCommand } from '../../src/commands/node.mjs'
import { HEDERA_HAPI_PATH, ROOT_CONTAINER } from '../../src/core/constants.mjs'
import fs from 'fs'

export function testNodeDelete (namespacePostfix, hederaImage) {
  describe(`Node delete [${namespacePostfix}`, () => {
    const namespace = `node-delete-${namespacePostfix}`
    const nodeId = 'node1'
    const argv = getDefaultArgv()
    argv[flags.hederaImage.name] = hederaImage
    argv[flags.nodeIDs.name] = 'node1,node2,node3,node4'
    argv[flags.nodeID.name] = nodeId
    argv[flags.generateGossipKeys.name] = true
    argv[flags.generateTlsKeys.name] = true
    argv[flags.persistentVolumeClaims.name] = true
    // set the env variable SOLO_FST_CHARTS_DIR if developer wants to use local FST charts
    argv[flags.chartDirectory.name] = process.env.SOLO_FST_CHARTS_DIR ? process.env.SOLO_FST_CHARTS_DIR : undefined
    argv[flags.releaseTag.name] = HEDERA_PLATFORM_VERSION_TAG
    argv[flags.namespace.name] = namespace
    const bootstrapResp = bootstrapNetwork(namespace, argv)
    const nodeCmd = bootstrapResp.cmd.nodeCmd
    const accountCmd = bootstrapResp.cmd.accountCmd
    const k8 = bootstrapResp.opts.k8

    afterAll(async () => {
      await getNodeLogs(k8, namespace)
      await nodeCmd.accountManager.close()
      await nodeCmd.stop(argv)
      await k8.deleteNamespace(namespace)
    }, 600000)

    it('should succeed with init command', async () => {
      const status = await accountCmd.init(argv)
      expect(status).toBeTruthy()
    }, 450000)

    it('should delete a new node to the network successfully', async () => {
      await nodeCmd.delete(argv)
      const expectedUnusedConfigs = [
        flags.app.constName,
        flags.devMode.constName,
        flags.endpointType.constName
      ]
      if (bootstrapResp.opts.configManager.getFlag(flags.hederaImage)) {
        expectedUnusedConfigs.push(flags.localBuildPath.constName)
      }
      expect(nodeCmd.getUnusedConfigs(NodeCommand.DELETE_CONFIGS_NAME)).toEqual(expectedUnusedConfigs)

      await nodeCmd.accountManager.close()
    }, 600000)

    balanceQueryShouldSucceed(nodeCmd.accountManager, nodeCmd, namespace)

    accountCreationShouldSucceed(nodeCmd.accountManager, nodeCmd, namespace)

    it('config.txt should no longer contain removed nodeid', async () => {
      // read config.txt file from first node, read config.txt line by line, it should not contain value of nodeId
      // get the pod name of the network node
      let podName
      const pods = await k8.getPodsByLabel(['fullstack.hedera.com/type=network-node'])
      for (const pod of pods) {
        podName = pod.metadata.name
        const nodeName = pod.metadata.labels['fullstack.hedera.com/node-name']
        if (nodeName !== nodeId) {
          // don't try to get the config.txt from the nodeId that we deleted, as it won't be running if we are using hedera deterministic image
          break
        }
      }
      const tmpDir = getTmpDir()
      await k8.copyFrom(podName, ROOT_CONTAINER, `${HEDERA_HAPI_PATH}/config.txt`, tmpDir)
      const configTxt = fs.readFileSync(`${tmpDir}/config.txt`, 'utf8')
      console.log('config.txt:', configTxt)
      expect(configTxt).not.toContain(nodeId)
    }, 600000)
  })
}