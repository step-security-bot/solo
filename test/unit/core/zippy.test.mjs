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
import { describe, it } from 'mocha'

import * as core from '../../../src/core/index.mjs'
import { IllegalArgumentError, MissingArgumentError, SoloError } from '../../../src/core/errors.mjs'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { Zippy } from '../../../src/core/zippy.mjs'

describe('Zippy', () => {
  const testLogger = core.logging.NewLogger('debug', true)
  const zippy = new Zippy(testLogger)

  describe('unzip', () => {
    it('should fail if source file is missing', () => {
      expect(() => zippy.unzip('', '')).to.throw(MissingArgumentError)
    })

    it('should fail if destination file is missing', () => {
      expect(() => zippy.unzip('test/data/test.zip', '')).to.throw(MissingArgumentError)
    })

    it('should fail if source file is invalid', () => {
      expect(() => zippy.unzip('/INVALID', os.tmpdir())).to.throw(IllegalArgumentError)
    })

    it('should fail for a directory', () => {
      expect(() => zippy.unzip('test/data', os.tmpdir())).to.throw(SoloError)
    })

    it('should fail for a non-zip file', () => {
      expect(() => zippy.unzip('test/data/test.txt', os.tmpdir())).to.throw(SoloError)
    })

    it('should succeed for valid inputs', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'installer-'))
      const zipFile = `${tmpDir}/test.zip`
      const unzippedFile = `${tmpDir}/unzipped`
      await expect(zippy.zip('test/data/.empty', zipFile)).to.eventually.equal(zipFile)
      expect(zippy.unzip(zipFile, unzippedFile, true)).to.equal(unzippedFile)
      fs.rmSync(tmpDir, {recursive: true, force: true})
    })
  })

  describe('untar', () => {
    it('should fail if source file is missing', () => {
      expect(() => zippy.untar('', '')).to.throw(MissingArgumentError)
    })

    it('should fail if destination file is missing', () => {
      expect(() => zippy.untar('test/data/test.tar', '')).to.throw(MissingArgumentError)
    })

    it('should fail if source file is invalid', () => {
      expect(() => zippy.untar('/INVALID', os.tmpdir())).to.throw(IllegalArgumentError)
    })

    it('should fail for a directory', () => {
      expect(() => zippy.untar('test/data', os.tmpdir())).to.throw(SoloError)
    })

    it('should fail for a non-tar file', () => {
      expect(() => zippy.untar('test/data/test.txt', os.tmpdir())).to.throw(SoloError)
    })

    it('should succeed for valid inputs', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'installer-'))
      const tarFile = `${tmpDir}/test.tar.gz`
      expect(zippy.tar('test/data/.empty', tarFile)).to.equal(tarFile)
      expect(zippy.untar(tarFile, tmpDir, true)).to.equal(tmpDir)
      fs.rmSync(tmpDir, {recursive: true, force: true})
    })
  })
})
