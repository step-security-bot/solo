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
 */
import { ListrEnquirerPromptAdapter } from '@listr2/prompt-adapter-enquirer'
import fs from 'fs'
import { SoloError, IllegalArgumentError } from '../core/errors.ts'
import { ConfigManager, constants } from '../core/index.ts'
import * as flags from './flags.ts'
import * as helpers from '../core/helpers.ts'
import { resetDisabledPrompts } from './flags.ts'
import type { ListrTaskWrapper } from 'listr2'
import { type CommandFlag } from '../types/index.js'

async function prompt (type: string, task: ListrTaskWrapper<any, any, any>, input: any, defaultValue: any, promptMessage: string, emptyCheckMessage: string | null, flagName: string) {
  try {
    let needsPrompt = type === 'toggle' ? (input === undefined || typeof input !== 'boolean') : !input
    needsPrompt = type === 'number' ? typeof input !== 'number' : needsPrompt

    if (needsPrompt) {
      input = await task.prompt(ListrEnquirerPromptAdapter).run({
        type,
        default: defaultValue,
        message: promptMessage
      })
    }

    if (emptyCheckMessage && !input) {
      throw new SoloError(emptyCheckMessage)
    }

    return input
  } catch (e: Error | any) {
    throw new SoloError(`input failed: ${flagName}: ${e.message}`, e)
  }
}

async function promptText (task: ListrTaskWrapper<any, any, any>, input: any, defaultValue: any, promptMessage: string,
    emptyCheckMessage: string | null, flagName: string) {
  return await prompt('text', task, input, defaultValue, promptMessage, emptyCheckMessage, flagName)
}

async function promptToggle (task: ListrTaskWrapper<any, any, any>, input: any, defaultValue: any, promptMessage: string,
    emptyCheckMessage: string| null, flagName: string) {
  return await prompt('toggle', task, input, defaultValue, promptMessage, emptyCheckMessage, flagName)
}

export async function promptNamespace (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    'solo',
    'Enter namespace name: ',
    'namespace cannot be empty',
    flags.namespace.name)
}

export async function promptClusterSetupNamespace (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    'solo-cluster',
    'Enter cluster setup namespace name: ',
    'cluster setup namespace cannot be empty',
    flags.clusterSetupNamespace.name)
}

export async function promptNodeAliases (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await prompt('input', task, input,
    'node1,node2,node3',
    'Enter list of node IDs (comma separated list): ',
    null,
    flags.nodeAliasesUnparsed.name)
}

export async function promptReleaseTag (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    'v0.42.5',
    'Enter release version: ',
    'release tag cannot be empty',
    flags.releaseTag.name)
}

export async function promptRelayReleaseTag (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    flags.relayReleaseTag.definition.defaultValue,
    'Enter relay release version: ',
    'relay-release-tag cannot be empty',
    flags.relayReleaseTag.name)
}

export async function promptCacheDir (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    constants.SOLO_CACHE_DIR,
    'Enter local cache directory path: ',
    null,
    flags.cacheDir.name)
}

export async function promptForce (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.force.definition.defaultValue,
    'Would you like to force changes? ',
    null,
    flags.force.name)
}

export async function promptChainId (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    flags.chainId.definition.defaultValue,
    'Enter chain ID: ',
    null,
    flags.chainId.name)
}

export async function promptChartDir (task: ListrTaskWrapper<any, any, any>, input: any) {
  try {
    if (input === 'false') {
      return ''
    }

    if (input && !fs.existsSync(input)) {
      input = await task.prompt(ListrEnquirerPromptAdapter).run({
        type: 'text',
        default: flags.chartDirectory.definition.defaultValue,
        message: 'Enter local charts directory path: '
      })

      if (!fs.existsSync(input)) {
        throw new IllegalArgumentError('Invalid chart directory', input)
      }
    }

    return input
  } catch (e: Error | any) {
    throw new SoloError(`input failed: ${flags.chartDirectory.name}`, e)
  }
}

export async function promptValuesFile (task: ListrTaskWrapper<any, any, any>, input: any) {
  try {
    if (input && !fs.existsSync(input)) {
      input = await task.prompt(ListrEnquirerPromptAdapter).run({
        type: 'text',
        default: flags.valuesFile.definition.defaultValue,
        message: 'Enter path to values.yaml: '
      })

      if (!fs.existsSync(input)) {
        throw new IllegalArgumentError('Invalid values.yaml file', input)
      }
    }

    return input
  } catch (e: Error | any) {
    throw new SoloError(`input failed: ${flags.valuesFile.name}`, e)
  }
}

export async function promptProfileFile (task: ListrTaskWrapper<any, any, any>, input: any) {
  if (input && !fs.existsSync(input)) {
    input = await task.prompt(ListrEnquirerPromptAdapter).run({
      type: 'text',
      default: flags.valuesFile.definition.defaultValue,
      message: 'Enter path to custom resource profile definition file: '
    })
  }

  if (input && !fs.existsSync(input)) {
    throw new IllegalArgumentError(`Invalid profile definition file: ${input}}`, input)
  }

  return input
}

export async function promptProfile (task: ListrTaskWrapper<any, any, any>, input: any, choices = constants.ALL_PROFILES) {
  try {
    const initial = choices.indexOf(input)
    if (initial < 0) {
      const input = await task.prompt(ListrEnquirerPromptAdapter).run({
        type: 'select',
        message: 'Select profile for solo network deployment',
        choices: helpers.cloneArray(choices)
      })

      if (!input) {
        throw new SoloError('key-format cannot be empty')
      }

      return input
    }

    return input
  } catch (e: Error | any) {
    throw new SoloError(`input failed: ${flags.profileName.name}`, e)
  }
}

export async function promptDeployPrometheusStack (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.deployPrometheusStack.definition.defaultValue,
    'Would you like to deploy prometheus stack? ',
    null,
    flags.deployPrometheusStack.name)
}

export async function promptEnablePrometheusSvcMonitor (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.enablePrometheusSvcMonitor.definition.defaultValue,
    'Would you like to enable the Prometheus service monitor for the network nodes? ',
    null,
    flags.enablePrometheusSvcMonitor.name)
}

export async function promptDeployMinio (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.deployMinio.definition.defaultValue,
    'Would you like to deploy MinIO? ',
    null,
    flags.deployMinio.name)
}

export async function promptDeployCertManager (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.deployCertManager.definition.defaultValue,
    'Would you like to deploy Cert Manager? ',
    null,
    flags.deployCertManager.name)
}

export async function promptDeployCertManagerCrds (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.deployCertManagerCrds.definition.defaultValue,
    'Would you like to deploy Cert Manager CRDs? ',
    null,
    flags.deployCertManagerCrds.name)
}

export async function promptDeployHederaExplorer (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.deployHederaExplorer.definition.defaultValue,
    'Would you like to deploy Hedera Explorer? ',
    null,
    flags.deployHederaExplorer.name)
}

export async function promptTlsClusterIssuerType (task: ListrTaskWrapper<any, any, any>, input: any) {
  try {
    if (!input) {
      input = await task.prompt(ListrEnquirerPromptAdapter).run({
        type: 'text',
        default: flags.tlsClusterIssuerType.definition.defaultValue,
        message: 'Enter TLS cluster issuer type, available options are: "acme-staging", "acme-prod", or "self-signed":'
      })
    }

    if (!input || !['acme-staging', 'acme-prod', 'self-signed'].includes(input)) {
      throw new SoloError('must be one of: "acme-staging", "acme-prod", or "self-signed"')
    }

    return input
  } catch (e: Error | any) {
    throw new SoloError(`input failed: ${flags.tlsClusterIssuerType.name}`, e)
  }
}

export async function promptEnableHederaExplorerTls (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.enableHederaExplorerTls.definition.defaultValue,
    'Would you like to enable the Hedera Explorer TLS? ',
    null,
    flags.enableHederaExplorerTls.name)
}

export async function promptHederaExplorerTlsHostName (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    flags.hederaExplorerTlsHostName.definition.defaultValue,
    'Enter the host name to use for the Hedera Explorer TLS: ',
    null,
    flags.hederaExplorerTlsHostName.name)
}

export async function promptOperatorId (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    flags.operatorId.definition.defaultValue,
    'Enter operator ID: ',
    null,
    flags.operatorId.name)
}

export async function promptOperatorKey (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    flags.operatorKey.definition.defaultValue,
    'Enter operator private key: ',
    null,
    flags.operatorKey.name)
}

export async function promptReplicaCount (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await prompt('number', task, input,
    flags.replicaCount.definition.defaultValue,
    'How many replica do you want? ',
    null,
    flags.replicaCount.name)
}

export async function promptGenerateGossipKeys (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.generateGossipKeys.definition.defaultValue,
    `Would you like to generate Gossip keys? ${typeof input} ${input} `,
    null,
    flags.generateGossipKeys.name)
}

export async function promptGenerateTLSKeys (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.generateTlsKeys.definition.defaultValue,
    'Would you like to generate TLS keys? ',
    null,
    flags.generateTlsKeys.name)
}

export async function promptDeletePvcs (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.deletePvcs.definition.defaultValue,
    'Would you like to delete persistent volume claims upon uninstall? ',
    null,
    flags.deletePvcs.name)
}

export async function promptDeleteSecrets (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.deleteSecrets.definition.defaultValue,
    'Would you like to delete secrets upon uninstall? ',
    null,
    flags.deleteSecrets.name)
}

export async function promptSoloChartVersion (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    flags.soloChartVersion.definition.defaultValue,
    'Enter solo testing chart version: ',
    null,
    flags.soloChartVersion.name)
}

export async function promptUpdateAccountKeys (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.updateAccountKeys.definition.defaultValue,
    'Would you like to updates the special account keys to new keys and stores their keys in a corresponding Kubernetes secret? ',
    null,
    flags.updateAccountKeys.name)
}

export async function promptPrivateKey (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    flags.privateKey.definition.defaultValue,
    'Enter the private key: ',
    null,
    flags.privateKey.name)
}

export async function promptAccountId (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    flags.accountId.definition.defaultValue,
    'Enter the account id: ',
    null,
    flags.accountId.name)
}

export async function promptAmount (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await prompt('number', task, input,
    flags.amount.definition.defaultValue,
    'How much HBAR do you want to add? ',
    null,
    flags.amount.name)
}

export async function promptNewNodeAlias (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    flags.nodeAlias.definition.defaultValue,
    'Enter the new node id: ',
    null,
    flags.nodeAlias.name)
}

export async function promptGossipEndpoints (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    flags.gossipEndpoints.definition.defaultValue,
    'Enter the gossip endpoints(comma separated): ',
    null,
    flags.gossipEndpoints.name)
}

export async function promptGrpcEndpoints (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    flags.grpcEndpoints.definition.defaultValue,
    'Enter the gRPC endpoints(comma separated): ',
    null,
    flags.grpcEndpoints.name)
}

export async function promptEndpointType (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptText(task, input,
    flags.endpointType.definition.defaultValue,
    'Enter the endpoint type(IP or FQDN): ',
    null,
    flags.endpointType.name)
}

export async function promptPersistentVolumeClaims (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.persistentVolumeClaims.definition.defaultValue,
    'Would you like to enable persistent volume claims to store data outside the pod? ',
    null,
    flags.persistentVolumeClaims.name)
}

export async function promptMirrorNodeVersion (task: ListrTaskWrapper<any, any, any>, input: any) {
  return await promptToggle(task, input,
    flags.mirrorNodeVersion.definition.defaultValue,
    'Would you like to choose mirror node version? ',
    null,
    flags.mirrorNodeVersion.name)
}

export function getPromptMap (): Map<string, Function> {
  return new Map()
    .set(flags.accountId.name, promptAccountId)
    .set(flags.amount.name, promptAmount)
    .set(flags.cacheDir.name, promptCacheDir)
    .set(flags.chainId.name, promptChainId)
    .set(flags.chartDirectory.name, promptChartDir)
    .set(flags.clusterSetupNamespace.name, promptClusterSetupNamespace)
    .set(flags.deletePvcs.name, promptDeletePvcs)
    .set(flags.deleteSecrets.name, promptDeleteSecrets)
    .set(flags.deployCertManager.name, promptDeployCertManager)
    .set(flags.deployCertManagerCrds.name, promptDeployCertManagerCrds)
    .set(flags.deployHederaExplorer.name, promptDeployHederaExplorer)
    .set(flags.deployMinio.name, promptDeployMinio)
    .set(flags.deployPrometheusStack.name, promptDeployPrometheusStack)
    .set(flags.enableHederaExplorerTls.name, promptEnableHederaExplorerTls)
    .set(flags.enablePrometheusSvcMonitor.name, promptEnablePrometheusSvcMonitor)
    .set(flags.force.name, promptForce)
    .set(flags.soloChartVersion.name, promptSoloChartVersion)
    .set(flags.generateGossipKeys.name, promptGenerateGossipKeys)
    .set(flags.generateTlsKeys.name, promptGenerateTLSKeys)
    .set(flags.hederaExplorerTlsHostName.name, promptHederaExplorerTlsHostName)
    .set(flags.namespace.name, promptNamespace)
    .set(flags.nodeAliasesUnparsed.name, promptNodeAliases)
    .set(flags.operatorId.name, promptOperatorId)
    .set(flags.operatorKey.name, promptOperatorKey)
    .set(flags.persistentVolumeClaims.name, promptPersistentVolumeClaims)
    .set(flags.privateKey.name, promptPrivateKey)
    .set(flags.profileFile.name, promptProfileFile)
    .set(flags.profileName.name, promptProfile)
    .set(flags.relayReleaseTag.name, promptRelayReleaseTag)
    .set(flags.releaseTag.name, promptReleaseTag)
    .set(flags.replicaCount.name, promptReplicaCount)
    .set(flags.tlsClusterIssuerType.name, promptTlsClusterIssuerType)
    .set(flags.updateAccountKeys.name, promptUpdateAccountKeys)
    .set(flags.valuesFile.name, promptValuesFile)
    .set(flags.nodeAlias.name, promptNewNodeAlias)
    .set(flags.gossipEndpoints.name, promptGossipEndpoints)
    .set(flags.grpcEndpoints.name, promptGrpcEndpoints)
    .set(flags.endpointType.name, promptEndpointType)
    .set(flags.mirrorNodeVersion.name, promptMirrorNodeVersion)
}

// build the prompt registry
/**
 * Run prompts for the given set of flags
 * @param task task object from listr2
 * @param configManager config manager to store flag values
 * @param flagList list of flag objects
 */
export async function execute (task: ListrTaskWrapper<any, any, any>, configManager: ConfigManager, flagList: CommandFlag[] = []) {
  if (!configManager || !(configManager instanceof ConfigManager)) {
    throw new IllegalArgumentError('an instance of ConfigManager is required')
  }
  const prompts = getPromptMap()
  for (const flag of flagList) {
    if (flag.definition.disablePrompt) {
      continue
    }

    if (!prompts.has(flag.name)) {
      throw new SoloError(`No prompt available for flag: ${flag.name}`)
    }

    const prompt = prompts.get(flag.name) as Function
    if (configManager.getFlag(flags.quiet)) {
      return
    }
    const input = await prompt(task, configManager.getFlag(flag))
    configManager.setFlag(flag, input)
  }

  configManager.persist()
}

/**
 * Disable prompts for the given set of flags
 * @param flags list of flags to disable prompts for
 */
export function disablePrompts (flags: CommandFlag[]) {
  resetDisabledPrompts()
  for (const flag of flags) {
    if (flag.definition) {
      flag.definition.disablePrompt = true
    }
  }
}
