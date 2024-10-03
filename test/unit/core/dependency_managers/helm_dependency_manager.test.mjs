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

  before(async () => fs.mkdirSync(tmpDir))

  after(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true })
    }
  })

  it('should return helm version', () => {
    const helmDependencyManager = new HelmDependencyManager(downloader, zippy, testLogger, tmpDir)
    expect(helmDependencyManager.getHelmVersion()).deep.equal(version.HELM_VERSION)
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

  it.each(
    [{ osPlatform: 'linux', osArch: 'x64' }, { osRelease: 'linux', osArch: 'amd64' }, { osRelease: 'windows', osArch: 'amd64' }],
    'should be able to install helm base on os and architecture',
    async (input) => {
      const helmDependencyManager = new HelmDependencyManager(downloader, zippy, testLogger, tmpDir, input.osPlatform, input.osArch)
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true })
      }

      await helmDependencyManager.uninstall()
      expect(helmDependencyManager.isInstalled()).not.to.be.ok
      await expect(helmDependencyManager.install(getTestCacheDir())).should.eventually.be.ok
      expect(helmDependencyManager.isInstalled()).should.eventually.be.ok
      fs.rmSync(tmpDir, { recursive: true })
    }
  )
})
