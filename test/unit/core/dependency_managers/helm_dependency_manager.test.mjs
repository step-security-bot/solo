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
import { expect } from 'chai'
import { after, before, describe, it } from 'mocha'
import each from 'mocha-each'

import fs from 'fs'
import path from 'path'
import { HelmDependencyManager } from '../../../../src/core/dependency_managers/index.mjs'
import { PackageDownloader, Zippy } from '../../../../src/core/index.mjs'
import { getTestCacheDir, getTmpDir, testLogger } from '../../../test_util.js'
import * as version from '../../../../version.mjs'

describe('HelmDependencyManager', () => {
  const downloader = new PackageDownloader(testLogger)
  const tmpDir = path.join(getTmpDir(), 'bin')
  const zippy = new Zippy(testLogger)

  before(() => fs.mkdirSync(tmpDir))

  after(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, {recursive: true})
    }
  })

  it('should return helm version', () => {
    const helmDependencyManager = new HelmDependencyManager(downloader, zippy, testLogger, tmpDir)
    expect(helmDependencyManager.getHelmVersion()).to.equal(version.HELM_VERSION)
  })

  it('should be able to check when helm not installed', () => {
    const helmDependencyManager = new HelmDependencyManager(downloader, zippy, testLogger, tmpDir)
    expect(helmDependencyManager.isInstalled()).not.to.be.ok
  })

  it('should be able to check when helm is installed', () => {
    const helmDependencyManager = new HelmDependencyManager(downloader, zippy, testLogger, tmpDir)
    fs.writeFileSync(helmDependencyManager.getHelmPath(), '')
    expect(helmDependencyManager.isInstalled()).to.be.ok
  })

  describe('Helm Installation Tests', () => {
    each([
      // ['linux', 'x64'],
      // ['linux', 'amd64'],
      // ['windows', 'amd64']
    ])
      .it('should be able to install helm for osPlatform: %s, osArch: %s', async (osPlatform, osArch) => {
        const helmDependencyManager = new HelmDependencyManager(downloader, zippy, testLogger, tmpDir, osPlatform, osArch)

        if (fs.existsSync(tmpDir)) {
          fs.rmSync(tmpDir, {recursive: true})
        }

        await helmDependencyManager.uninstall()
        expect(helmDependencyManager.isInstalled()).not.to.be.ok

        await expect(helmDependencyManager.install(getTestCacheDir())).to.eventually.be.ok
        expect(helmDependencyManager.isInstalled()).to.be.ok

        fs.rmSync(tmpDir, {recursive: true})
      })
  })
})
