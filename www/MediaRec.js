/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var argscheck = require('cordova/argscheck'),
    utils = require('cordova/utils'),
    exec = require('cordova/exec');

var mediaObjects = {};

/**
 * This class provides access to the device media, interfaces to both sound and video
 *
 * @constructor
 * @param src                   The file name or url to play
 * @param successCallback       The callback to be called when the file is done playing or recording.
 *                                  successCallback()
 * @param errorCallback         The callback to be called if there is an error.
 *                                  errorCallback(int errorCode) - OPTIONAL
 * @param statusCallback        The callback to be called when media status has changed.
 *                                  statusCallback(int statusCode) - OPTIONAL
 */
var MediaRec = function(src, successCallback, errorCallback, statusCallback) {
    argscheck.checkArgs('sFFF', 'MediaRec', arguments);
    this.id = utils.createUUID();
    mediaObjects[this.id] = this;
    this.src = src;
    this.successCallback = successCallback;
    this.errorCallback = errorCallback;
    this.statusCallback = statusCallback;
    this._duration = -1;
    this._position = -1;
    exec(null, this.errorCallback, "MediaRec", "create", [this.id, this.src]);
};

// MediaRec messages
MediaRec.MEDIA_STATE = 1;
MediaRec.MEDIA_DURATION = 2;
MediaRec.MEDIA_POSITION = 3;
MediaRec.MEDIA_ERROR = 9;

// MediaRec states
MediaRec.MEDIA_NONE = 0;
MediaRec.MEDIA_STARTING = 1;
MediaRec.MEDIA_RUNNING = 2;
MediaRec.MEDIA_PAUSED = 3;
MediaRec.MEDIA_STOPPED = 4;
MediaRec.MEDIA_MSG = ["None", "Starting", "Running", "Paused", "Stopped"];

// "static" function to return existing objs.
MediaRec.get = function(id) {
    return mediaObjects[id];
};

/**
 * Start or resume playing audio file.
 */
MediaRec.prototype.play = function(options) {
    exec(null, null, "MediaRec", "startPlayingAudio", [this.id, this.src, options]);
};

/**
 * Stop playing audio file.
 */
MediaRec.prototype.stop = function() {
    var me = this;
    exec(function() {
        me._position = 0;
    }, this.errorCallback, "MediaRec", "stopPlayingAudio", [this.id]);
};

/**
 * Seek or jump to a new time in the track..
 */
MediaRec.prototype.seekTo = function(milliseconds) {
    var me = this;
    exec(function(p) {
        me._position = p;
    }, this.errorCallback, "MediaRec", "seekToAudio", [this.id, milliseconds]);
};

/**
 * Pause playing audio file.
 */
MediaRec.prototype.pause = function() {
    exec(null, this.errorCallback, "MediaRec", "pausePlayingAudio", [this.id]);
};

/**
 * Get duration of an audio file.
 * The duration is only set for audio that is playing, paused or stopped.
 *
 * @return      duration or -1 if not known.
 */
MediaRec.prototype.getDuration = function() {
    return this._duration;
};

/**
 * Get position of audio.
 */
MediaRec.prototype.getCurrentPosition = function(success, fail) {
    var me = this;
    exec(function(p) {
        me._position = p;
        success(p);
    }, fail, "MediaRec", "getCurrentPositionAudio", [this.id]);
};

/**
 * Start recording audio file.
 */
MediaRec.prototype.startRecord = function() {
    exec(null, this.errorCallback, "MediaRec", "startRecordingAudio", [this.id, this.src]);
};

/**
 * Start recording audio file, with compression, for iOS only.
 */

MediaRec.prototype.startRecordWithCompression = function(options) {
    exec(null, this.errorCallback, "MediaRec", "startRecordingAudioWithCompression", [this.id, this.src, options]);
};


/**
 * Stop recording audio file.
 */
MediaRec.prototype.stopRecord = function() {
    exec(null, this.errorCallback, "MediaRec", "stopRecordingAudio", [this.id]);
};

/**
 * Pause recording audio file.
 */
MediaRec.prototype.pauseRecord = function() {
    exec(null, this.errorCallback, "MediaRec", "pauseRecordingAudio", [this.id]);
};

/**
 * Resume recording audio file.
 */
MediaRec.prototype.resumeRecord = function() {
    exec(null, this.errorCallback, "MediaRec", "resumeRecordingAudio", [this.id, this.src]);
};

/**
 * Get recording levels, 
 * Android returns avgMaxPower in dB
 iOS returns peakPowerForChannel and averagePowerForChannel (in dB, -160 to 0 ).
 */

if (cordova.platformId === 'android' ) {
    MediaRec.prototype.getRecordLevels = function(success, fail) {
        var me = this;
        exec(function(p) {
            me._db = p;
            success(p);
        }, fail, "MediaRec", "getRecordDbLevel", [this.id]);
    };
} else if (cordova.platformId === 'ios') {
    MediaRec.prototype.getRecordLevels = function(success, fail) {
        exec(success,fail, "MediaRec", "getAudioRecordingLevels", [this.id]);
    };
}


/**
 * Release the resources.
 */
MediaRec.prototype.release = function() {
    exec(null, this.errorCallback, "MediaRec", "release", [this.id]);
};

/**
 * Adjust the volume.
 */
MediaRec.prototype.setVolume = function(volume) {
    exec(null, null, "MediaRec", "setVolume", [this.id, volume]);
};

/**
 * Audio has status update.
 * PRIVATE
 *
 * @param id            The media object id (string)
 * @param msgType       The 'type' of update this is
 * @param value         Use of value is determined by the msgType
 */
MediaRec.onStatus = function(id, msgType, value) {

    var media = mediaObjects[id];

    if(media) {
        switch(msgType) {
            case MediaRec.MEDIA_STATE :
                media.statusCallback && media.statusCallback(value);
                if(value == MediaRec.MEDIA_STOPPED) {
                    media.successCallback && media.successCallback();
                }
                break;
            case MediaRec.MEDIA_DURATION :
                media._duration = value;
                break;
            case MediaRec.MEDIA_ERROR :
                media.errorCallback && media.errorCallback(value);
                break;
            case MediaRec.MEDIA_POSITION :
                media._position = Number(value);
                break;
            default :
                console.error && console.error("Unhandled MediaRec.onStatus :: " + msgType);
                break;
        }
    }
    else {
         console.error && console.error("Received MediaRec.onStatus callback for unknown media :: " + id);
    }

};

module.exports = MediaRec;

function onMessageFromNative(msg) {
    if (msg.action == 'status') {
        MediaRec.onStatus(msg.status.id, msg.status.msgType, msg.status.value);
    } else {
        throw new Error('Unknown media action' + msg.action);
    }
}

if (cordova.platformId === 'android' || cordova.platformId === 'amazon-fireos' || cordova.platformId === 'windowsphone') {

    var channel = require('cordova/channel');

    channel.createSticky('onMediaPluginReady');
    channel.waitForInitialization('onMediaPluginReady');

    channel.onCordovaReady.subscribe(function() {
        exec(onMessageFromNative, undefined, 'MediaRec', 'messageChannel', []);
        channel.initializationComplete('onMediaPluginReady');
    });
}
