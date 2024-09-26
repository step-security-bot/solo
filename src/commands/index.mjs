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
'use strict'
import { ClusterCommand } from './cluster.mjs'
import { InitCommand } from './init.mjs'
import { MirrorNodeCommand } from './mirror_node.mjs'
import { NetworkCommand } from './network.mjs'
import { NodeCommand } from './node.mjs'
import { RelayCommand } from './relay.mjs'
import { AccountCommand } from './account.mjs'
import { RolesCommand } from './roles.mjs'
import * as flags from './flags.mjs'

/**
 * Return a list of Yargs command builder to be exposed through CLI
 * @param {Object} opts it is an Options object containing logger
 * @returns {Array} an array of Yargs command builder
 */
function Initialize (opts) {
  const initCmd = new InitCommand(opts)
  const clusterCmd = new ClusterCommand(opts)
  const networkCommand = new NetworkCommand(opts)
  const nodeCmd = new NodeCommand(opts)
  const relayCmd = new RelayCommand(opts)
  const accountCmd = new AccountCommand(opts)
  const mirrorNodeCmd = new MirrorNodeCommand(opts)
  const rolesCmd = new RolesCommand(opts)

  return [
    InitCommand.getCommandDefinition(initCmd),
    ClusterCommand.getCommandDefinition(clusterCmd),
    NetworkCommand.getCommandDefinition(networkCommand),
    NodeCommand.getCommandDefinition(nodeCmd),
    RelayCommand.getCommandDefinition(relayCmd),
    AccountCommand.getCommandDefinition(accountCmd),
    MirrorNodeCommand.getCommandDefinition(mirrorNodeCmd),
    RolesCommand.getCommandDefinition(rolesCmd)
  ]
}

// Expose components from the command module
export { Initialize, flags }
