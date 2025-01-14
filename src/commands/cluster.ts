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
import { Listr } from 'listr2'
import { SoloError } from '../core/errors.ts'
import * as flags from './flags.ts'
import { BaseCommand } from './base.ts'
import chalk from 'chalk'
import { constants } from '../core/index.ts'
import * as prompts from './prompts.ts'
import path from 'path'

/**
 * Define the core functionalities of 'cluster' command
 */
export class ClusterCommand extends BaseCommand {
  showClusterList () {
    this.logger.showList('Clusters', this.k8.getClusters())
    return true
  }

  /** Get cluster-info for the given cluster name */
  getClusterInfo () {
    try {
      const cluster = this.k8.getKubeConfig().getCurrentCluster()
      this.logger.showJSON(`Cluster Information (${cluster.name})`, cluster)
      this.logger.showUser('\n')
      return true
    } catch (e: Error | any) {
      this.logger.showUserError(e)
    }

    return false
  }

  /** Show list of installed chart */
  async showInstalledChartList (clusterSetupNamespace: string) {
    this.logger.showList('Installed Charts', await this.chartManager.getInstalledCharts(clusterSetupNamespace))
  }

  /** Setup cluster with shared components */
  async setup (argv: any) {
    const self = this

    interface Context {
      config: {
        chartDir: string
        clusterSetupNamespace: string
        deployCertManager: boolean
        deployCertManagerCrds: boolean
        deployMinio: boolean
        deployPrometheusStack: boolean
        soloChartVersion: string
      };
      isChartInstalled: boolean
      chartPath: string
      valuesArg: string
    }

    const tasks = new Listr<Context>([
      {
        title: 'Initialize',
        task: async (ctx, task) => {
          self.configManager.update(argv)
          await prompts.execute(task, self.configManager, [
            flags.chartDirectory,
            flags.clusterSetupNamespace,
            flags.deployCertManager,
            flags.deployCertManagerCrds,
            flags.deployMinio,
            flags.deployPrometheusStack
          ])

          // prepare config
          ctx.config = {
            chartDir: <string>self.configManager.getFlag<string>(flags.chartDirectory),
            clusterSetupNamespace: <string>self.configManager.getFlag<string>(flags.clusterSetupNamespace),
            deployCertManager: <boolean>self.configManager.getFlag<boolean>(flags.deployCertManager),
            deployCertManagerCrds: <boolean>self.configManager.getFlag<boolean>(flags.deployCertManagerCrds),
            deployMinio: <boolean>self.configManager.getFlag<boolean>(flags.deployMinio),
            deployPrometheusStack: <boolean>self.configManager.getFlag<boolean>(flags.deployPrometheusStack),
            soloChartVersion: <string>self.configManager.getFlag<string>(flags.soloChartVersion)
          }

          self.logger.debug('Prepare ctx.config', { config: ctx.config, argv })

          ctx.isChartInstalled = await this.chartManager.isChartInstalled(ctx.config.clusterSetupNamespace, constants.SOLO_CLUSTER_SETUP_CHART)
        }
      },
      {
        title: 'Prepare chart values',
        task: async (ctx, _) => {
          ctx.chartPath = await this.prepareChartPath(ctx.config.chartDir)
          ctx.valuesArg = this.prepareValuesArg(
            ctx.config.chartDir,
            ctx.config.deployPrometheusStack,
            ctx.config.deployMinio,
            ctx.config.deployCertManager,
            ctx.config.deployCertManagerCrds
          )
        },
        skip: (ctx) => ctx.isChartInstalled
      },
      {
        title: `Install '${constants.SOLO_CLUSTER_SETUP_CHART}' chart`,
        task: async (ctx, _) => {
          const clusterSetupNamespace = ctx.config.clusterSetupNamespace
          const version = ctx.config.soloChartVersion

          const chartPath = ctx.chartPath
          const valuesArg = ctx.valuesArg

          try {
            await self.chartManager.install(clusterSetupNamespace, constants.SOLO_CLUSTER_SETUP_CHART, chartPath, version, valuesArg)
          } catch (e: Error | any) {
            // if error, uninstall the chart and rethrow the error
            self.logger.debug(`Error on installing ${constants.SOLO_CLUSTER_SETUP_CHART}. attempting to rollback by uninstalling the chart`, e)
            try {
              await self.chartManager.uninstall(clusterSetupNamespace, constants.SOLO_CLUSTER_SETUP_CHART)
            } catch (ex) {
              // ignore error during uninstall since we are doing the best-effort uninstall here
            }

            throw e
          }

          if (argv.dev) {
            await self.showInstalledChartList(clusterSetupNamespace)
          }
        },
        skip: (ctx) => ctx.isChartInstalled
      }
    ], {
      concurrent: false,
      rendererOptions: constants.LISTR_DEFAULT_RENDERER_OPTION
    })

    try {
      await tasks.run()
    } catch (e: Error | any) {
      throw new SoloError('Error on cluster setup', e)
    }

    return true
  }

  async reset (argv: any) {
    const self = this

    interface Context {
      config: {
        clusterName: string
        clusterSetupNamespace: string
      };
      isChartInstalled: boolean
    }

    const tasks = new Listr<Context>([
      {
        title: 'Initialize',
        task: async (ctx, task) => {
          if (!argv[flags.force.name]) {
            const confirm = await task.prompt(ListrEnquirerPromptAdapter).run({
              type: 'toggle',
              default: false,
              message: 'Are you sure you would like to uninstall solo-cluster-setup chart?'
            })

            if (!confirm) {
              process.exit(0)
            }
          }

          self.configManager.update(argv)
          ctx.config = {
            clusterName: <string>self.configManager.getFlag<string>(flags.clusterName),
            clusterSetupNamespace: <string>self.configManager.getFlag<string>(flags.clusterSetupNamespace)
          }

          ctx.isChartInstalled = await this.chartManager.isChartInstalled(ctx.config.clusterSetupNamespace, constants.SOLO_CLUSTER_SETUP_CHART)
          if (!ctx.isChartInstalled) {
            throw new SoloError('No chart found for the cluster')
          }
        }
      },
      {
        title: `Uninstall '${constants.SOLO_CLUSTER_SETUP_CHART}' chart`,
        task: async (ctx, _) => {
          const clusterSetupNamespace = ctx.config.clusterSetupNamespace
          await self.chartManager.uninstall(clusterSetupNamespace, constants.SOLO_CLUSTER_SETUP_CHART)
          if (argv.dev) {
            await self.showInstalledChartList(clusterSetupNamespace)
          }
        },
        skip: (ctx) => !ctx.isChartInstalled
      }
    ], {
      concurrent: false,
      rendererOptions: constants.LISTR_DEFAULT_RENDERER_OPTION
    })

    try {
      await tasks.run()
    } catch (e: Error | any) {
      throw new SoloError('Error on cluster reset', e)
    }

    return true
  }

  /** Return Yargs command definition for 'cluster' command */
  getCommandDefinition (): { command: string; desc: string; builder: Function } {
    const clusterCmd = this
    return {
      command: 'cluster',
      desc: 'Manage solo testing cluster',
      builder: (yargs: any) => {
        return yargs
          .command({
            command: 'list',
            desc: 'List all available clusters',
            handler: (argv: any) => {
              clusterCmd.logger.debug("==== Running 'cluster list' ===", { argv })

              try {
                const r = clusterCmd.showClusterList()
                clusterCmd.logger.debug('==== Finished running `cluster list`====')

                if (!r) process.exit(1)
              } catch (err) {
                clusterCmd.logger.showUserError(err)
                process.exit(1)
              }
            }
          })
          .command({
            command: 'info',
            desc: 'Get cluster info',
            handler: (argv: any) => {
              clusterCmd.logger.debug("==== Running 'cluster info' ===", { argv })
              try {
                const r = this.getClusterInfo()
                clusterCmd.logger.debug('==== Finished running `cluster info`====')

                if (!r) process.exit(1)
              } catch (err: Error | any) {
                clusterCmd.logger.showUserError(err)
                process.exit(1)
              }
            }
          })
          .command({
            command: 'setup',
            desc: 'Setup cluster with shared components',
            builder: (y: any) => flags.setCommandFlags(y,
              flags.chartDirectory,
              flags.clusterName,
              flags.clusterSetupNamespace,
              flags.deployCertManager,
              flags.deployCertManagerCrds,
              flags.deployMinio,
              flags.deployPrometheusStack,
              flags.soloChartVersion
            ),
            handler: (argv: any) => {
              clusterCmd.logger.debug("==== Running 'cluster setup' ===", { argv })

              clusterCmd.setup(argv).then(r => {
                clusterCmd.logger.debug('==== Finished running `cluster setup`====')

                if (!r) process.exit(1)
              }).catch(err => {
                clusterCmd.logger.showUserError(err)
                process.exit(1)
              })
            }
          })
          .command({
            command: 'reset',
            desc: 'Uninstall shared components from cluster',
            builder: (y: any) => flags.setCommandFlags(y,
              flags.clusterName,
              flags.clusterSetupNamespace,
              flags.force
            ),
            handler: (argv: any) => {
              clusterCmd.logger.debug("==== Running 'cluster reset' ===", { argv })

              clusterCmd.reset(argv).then(r => {
                clusterCmd.logger.debug('==== Finished running `cluster reset`====')

                if (!r) process.exit(1)
              }).catch(err => {
                clusterCmd.logger.showUserError(err)
                process.exit(1)
              })
            }
          })
          .demandCommand(1, 'Select a cluster command')
      }
    }
  }

  /**
   * Prepare values arg for cluster setup command
   *
   * @param [chartDir] - local charts directory (default is empty)
   * @param [prometheusStackEnabled] - a bool to denote whether to install prometheus stack
   * @param [minioEnabled] - a bool to denote whether to install minio
   * @param [certManagerEnabled] - a bool to denote whether to install cert manager
   * @param [certManagerCrdsEnabled] - a bool to denote whether to install cert manager CRDs
   */
  prepareValuesArg (
    chartDir = <string>flags.chartDirectory.definition.defaultValue,
    prometheusStackEnabled = <boolean>flags.deployPrometheusStack.definition.defaultValue,
    minioEnabled = <boolean>flags.deployMinio.definition.defaultValue,
    certManagerEnabled = <boolean>flags.deployCertManager.definition.defaultValue,
    certManagerCrdsEnabled = <boolean>flags.deployCertManagerCrds.definition.defaultValue
  ) {
    let valuesArg = chartDir ? `-f ${path.join(chartDir, 'solo-cluster-setup', 'values.yaml')}` : ''

    valuesArg += ` --set cloud.prometheusStack.enabled=${prometheusStackEnabled}`
    valuesArg += ` --set cloud.minio.enabled=${minioEnabled}`
    valuesArg += ` --set cloud.certManager.enabled=${certManagerEnabled}`
    valuesArg += ` --set cert-manager.installCRDs=${certManagerCrdsEnabled}`

    if (certManagerEnabled && !certManagerCrdsEnabled) {
      this.logger.showUser(chalk.yellowBright('> WARNING:'), chalk.yellow(
        'cert-manager CRDs are required for cert-manager, please enable it if you have not installed it independently.'))
    }

    return valuesArg
  }

  /**
   * Prepare chart path
   * @param [chartDir] - local charts directory (default is empty)
   */
  async prepareChartPath (chartDir = <string>flags.chartDirectory.definition.defaultValue) {
    let chartPath = 'solo-charts/solo-cluster-setup'
    if (chartDir) {
      chartPath = path.join(chartDir, 'solo-cluster-setup')
      await this.helm.dependency('update', chartPath)
    }

    return chartPath
  }
}
