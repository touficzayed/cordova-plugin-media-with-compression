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

/*global MediaError, module, require*/

var argscheck = require('cordova/argscheck'),
    utils = require('cordova/utils');

var mediaObjects = {};

/**
 * Creates new Audio node and with necessary event listeners attached
 * @param  {MediaRec} media MediaRec object
 * @return {Audio}       Audio element 
 */
function createNode (media) {
    var node = new Audio();

    node.onloadstart = function () {
        MediaRec.onStatus(media.id, MediaRec.MEDIA_STATE, MediaRec.MEDIA_STARTING);
    };

    node.onplaying = function () {
        MediaRec.onStatus(media.id, MediaRec.MEDIA_STATE, MediaRec.MEDIA_RUNNING);
    };

    node.ondurationchange = function (e) {
        MediaRec.onStatus(media.id, MediaRec.MEDIA_DURATION, e.target.duration || -1);
    };

    node.onerror = function (e) {
        // Due to media.spec.15 It should return MediaError for bad filename
        var err = e.target.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ?
            { code: MediaError.MEDIA_ERR_ABORTED } :
            e.target.error;

        MediaRec.onStatus(media.id, MediaRec.MEDIA_ERROR, err);
    };

    node.onended = function () {
        MediaRec.onStatus(media.id, MediaRec.MEDIA_STATE, MediaRec.MEDIA_STOPPED);
    };

    if (media.src) {
        node.src = media.src;
    }

    return node;
}

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
    argscheck.checkArgs('SFFF', 'MediaRec', arguments);
    this.id = utils.createUUID();
    mediaObjects[this.id] = this;
    this.src = src;
    this.successCallback = successCallback;
    this.errorCallback = errorCallback;
    this.statusCallback = statusCallback;
    this._duration = -1;
    this._position = -1;

    MediaRec.onStatus(this.id, MediaRec.MEDIA_STATE, MediaRec.MEDIA_STARTING);
    
    try {
        this.node = createNode(this);
    } catch (err) {
        MediaRec.onStatus(this.id, MediaRec.MEDIA_ERROR, { code: MediaError.MEDIA_ERR_ABORTED });
    }
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

/**
 * Start or resume playing audio file.
 */
MediaRec.prototype.play = function() {

    // if MediaRec was released, then node will be null and we need to create it again
    if (!this.node) {
        try {
            this.node = createNode(this);
        } catch (err) {
            MediaRec.onStatus(this.id, MediaRec.MEDIA_ERROR, { code: MediaError.MEDIA_ERR_ABORTED });
        }
    }

    this.node.play();
};

/**
 * Stop playing audio file.
 */
MediaRec.prototype.stop = function() {
    try {
        this.pause();
        this.seekTo(0);
        MediaRec.onStatus(this.id, MediaRec.MEDIA_STATE, MediaRec.MEDIA_STOPPED);
    } catch (err) {
        MediaRec.onStatus(this.id, MediaRec.MEDIA_ERROR, err);
    }
};

/**
 * Seek or jump to a new time in the track..
 */
MediaRec.prototype.seekTo = function(milliseconds) {
    try {
        this.node.currentTime = milliseconds / 1000;
    } catch (err) {
        MediaRec.onStatus(this.id, MediaRec.MEDIA_ERROR, err);
    }
};

/**
 * Pause playing audio file.
 */
MediaRec.prototype.pause = function() {
    try {
        this.node.pause();
        MediaRec.onStatus(this.id, MediaRec.MEDIA_STATE, MediaRec.MEDIA_PAUSED);
    } catch (err) {
        MediaRec.onStatus(this.id, MediaRec.MEDIA_ERROR, err);
    }};

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
    try {
        var p = this.node.currentTime;
        MediaRec.onStatus(this.id, MediaRec.MEDIA_POSITION, p);
        success(p);
    } catch (err) {
        fail(err);
    }
};

/**
 * Start recording audio file.
 */
MediaRec.prototype.startRecord = function() {
    MediaRec.onStatus(this.id, MediaRec.MEDIA_ERROR, "Not supported");
};

/**
 * Stop recording audio file.
 */
MediaRec.prototype.stopRecord = function() {
    MediaRec.onStatus(this.id, MediaRec.MEDIA_ERROR, "Not supported");
};

/**
 * Release the resources.
 */
MediaRec.prototype.release = function() {
    try {
        delete this.node;
    } catch (err) {
        MediaRec.onStatus(this.id, MediaRec.MEDIA_ERROR, err);
    }};

/**
 * Adjust the volume.
 */
MediaRec.prototype.setVolume = function(volume) {
    this.node.volume = volume;
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
                if(value === MediaRec.MEDIA_STOPPED) {
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
    } else {
         console.error && console.error("Received MediaRec.onStatus callback for unknown media :: " + id);
    }
};

module.exports = MediaRec;
