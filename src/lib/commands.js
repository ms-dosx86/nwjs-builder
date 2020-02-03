
'use strict';

const { resolve } = require('path');
const { copy } = require('fs-extra');

const temp = require('temp').track();

const { ParseNwBuilderVersion } = require('./nwbuild');

const NWD = require('nwjs-download');

const Flow = require('node-async-flow');

const NWB = require('../');

const NwBuilderBuild = (path, options, callback) => {

    const context = {};

    Flow(function*(cb) {

        let err, version, flavor;

        [err, version, flavor] = yield ParseNwBuilderVersion(options.version, cb.expect(3));

        if(err) {
            return callback(err);
        }

        this.version = version;
        this.flavor = flavor;

        this.targets = [];

        if(options.platforms) {

            let parts = options.platforms.split(',');

            for(let platform of parts) {

                switch(platform) {
                case 'win32':
                    this.targets.push(['win', 'x86']);
                    break;
                case 'win64':
                    this.targets.push(['win', 'x64']);
                    break;
                case 'linux32':
                    this.targets.push(['linux', 'x86']);
                    break;
                case 'linux64':
                    this.targets.push(['linux', 'x64']);
                    break;
                case 'osx32':
                    this.targets.push(['osx', 'x86']);
                    break;
                case 'osx64':
                    this.targets.push(['osx', 'x64']);
                    break;
                default:
                    console.warn('WARN_PLATFORM_UNRECOGNIZED');
                    console.warn('platform:', platform);
                    break;
                }

            }

        }
        else {

            this.targets.push([process.platform, process.arch]);

        }

        this.path = path ? path : '.';

        console.log(this);

        for(let target of this.targets) {

            let err, platform, arch, binaryDir, buildDir;

            [platform, arch] = target;

            [err, , , binaryDir] = yield NWB.DownloadAndExtractBinary({
                version: this.version,
                platform: platform,
                arch: arch,
                flavor: this.flavor,
                mirror: options.mirror
            }, cb.expect(4));

            if(err) {
                return callback(err);
            }

            switch(NWD.GetPlatform(platform)) {
            case 'win32':

                [err, buildDir] = yield NWB.BuildWin32Binary(this.path, binaryDir, this.version, NWD.GetPlatform(platform), NWD.GetArch(arch), {
                    outputDir: options.outputDir ? options.outputDir : null,
                    outputName: options.outputName ? options.outputName : null,
                    executableName: options.executableName ? options.executableName : null,
                    outputFormat: options.outputFormat ? options.outputFormat : null,
                    includes: options.includes ? options.includes : null,
                    withFFmpeg: options.withFFmpeg ? true : false,
                    sideBySide: options.sideBySide ? true : false,
                    production: options.production ? true : false,
                    winIco: options.winIco ? options.winIco : null
                }, cb.expect(2));

                if(err) {
                    return callback(err);
                }

                console.log(`${ NWD.GetTarget(platform, arch) } build: ${ resolve(buildDir) }.`);

                break;
            case 'linux':

                [err, buildDir] = yield NWB.BuildLinuxBinary(this.path, binaryDir, this.version, NWD.GetPlatform(platform), NWD.GetArch(arch), {
                    outputDir: options.outputDir ? options.outputDir : null,
                    outputName: options.outputName ? options.outputName : null,
                    executableName: options.executableName ? options.executableName : null,
                    outputFormat: options.outputFormat ? options.outputFormat : null,
                    includes: options.includes ? options.includes : null,
                    withFFmpeg: options.withFFmpeg ? true : false,
                    sideBySide: options.sideBySide ? true : false,
                    production: options.production ? true : false
                }, cb.expect(2));

                if(err) {
                    return callback(err);
                }

                console.log(`${ NWD.GetTarget(platform, arch) } build: ${ resolve(buildDir) }.`);

                break;
            case 'darwin':

                [err, buildDir] = yield NWB.BuildDarwinBinary(this.path, binaryDir, this.version, NWD.GetPlatform(platform), NWD.GetArch(arch), {
                    outputDir: options.outputDir ? options.outputDir : null,
                    outputName: options.outputName ? options.outputName : null,
                    executableName: options.executableName ? options.executableName : null,
                    outputFormat: options.outputFormat ? options.outputFormat : null,
                    includes: options.includes ? options.includes : null,
                    withFFmpeg: options.withFFmpeg ? true : false,
                    sideBySide: options.sideBySide ? true : false,
                    production: options.production ? true : false,
                    macIcns: options.macIcns ? options.macIcns : null
                }, cb.expect(2));

                if(err) {
                    return callback(err);
                }

                console.log(`${ NWD.GetTarget(platform, arch) } build: ${ resolve(buildDir) }`);

                break;
            }

            console.log();

        }

        callback(null, buildDir);

    }.bind(context));

};

const NwBuilderRun = (args, options, callback) => {

    const context = {};

    Flow(function*(cb) {

        let err, version, flavor, binaryDir, workingDir, code;

        // Parse platform and arch.

        this.platform = process.platform;
        this.arch = process.arch;

        // Parse version.

        [err, version, flavor] = yield ParseNwBuilderVersion(options.version, cb.expect(3));

        if(err) {
            return callback(err);
        }

        this.version = version;
        this.flavor = flavor;

        console.log(this);

        [err, , , binaryDir] = yield NWB.DownloadAndExtractBinary({
            version: this.version,
            platform: this.platform,
            arch: this.arch,
            flavor: this.flavor,
            mirror: options.mirror
        }, cb.expect(4));

        if(err) {
            return callback(err);
        }

        [err, workingDir] = yield temp.mkdir(null, cb.expect(2));

        if(err) {
            return callback(err);
        }

        console.log(`workingDir: ${ workingDir }`);

        err = yield copy(binaryDir, workingDir, cb.single);

        if(options.withFFmpeg) {

            let err, tempDir;

            console.log(`Install ffmpeg for nw.js ${ version }`);

            // Make a temporary directory.

            [err, tempDir] = yield temp.mkdir(null, cb.expect(2));

            if(err) {
                return callback(err);
            }

            // Extract FFmpeg to temporary directory.

            [err, , ] = yield NWB.DownloadAndExtractFFmpeg(tempDir, {
                version: this.version,
                platform: this.platform,
                arch: this.arch
            }, cb.expect(3));

            if(err) {
                return callback(err);
            }

            err = yield NWB.InstallFFmpeg(tempDir, workingDir, this.platform, cb.single);

            if(err) {
                return callback(err);
            }

        }

        const executable = NWB.GetExecutable(workingDir, this.platform);

        if(options.detached) {

            NWB.LaunchExecutable(executable, args, true, (err, code) => {

                if(err) {
                    return callback(err);
                }

            });

            // FIXME: If we end too fast, the nw.js process might crash.
            yield setTimeout(cb.single, 1000);

            console.log(`nwjs-builder exits without waiting for nw.js process.`);

        }
        else {

            [err, code] = yield NWB.LaunchExecutable(executable, args, false, cb.expect(2));

            if(err) {
                return callback(err);
            }

            console.log(`nw.js exits with code ${ code }.`);

        }

        callback(null, code);

    }.bind(context));

};

const nwbuild = (pathOrArgs, options, callback) => {

    if(options.include) {

        console.warn('options.include is deprecated, use options.includes instead.');
        options.includes = options.include;

    }

    if(options.withFfmpeg) {

        console.warn('options.withFfmpeg is deprecated, use options.withFFmpeg instead.');
        options.withFFmpeg = options.withFfmpeg;

    }

    if(!callback) {

        callback = (err, code) => {

            if(err) {
                console.error(err);
                return;
            }

            if(options.run) {
                process.exit(code);
            }
            else {
                console.log('All done.');
            }

        }

    }

    if(options.run) {

        NwBuilderRun(pathOrArgs, options, callback);

    }
    else {

        const path = Array.isArray(pathOrArgs) ? pathOrArgs[0] : pathOrArgs;

        NwBuilderBuild(path, options, callback);

    }

}

Object.assign(module.exports, {
    nwbuild
});
