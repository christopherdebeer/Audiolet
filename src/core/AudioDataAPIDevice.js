/*!
 * @depends AbstractAudioletDevice.js
 */

/**
 * Audio device using the Audio Data API.  If bufferSize is undefined,
 * automatically tries to work out the best value.
 *
 * **Inputs**
 *
 * - Audio
 *
 * @constructor
 * @extends AbstractAudioletDevice
 * @param {Audiolet} audiolet The audiolet object.
 * @param {Number} [sampleRate=44100] The sample rate to run at.
 * @param {Number} [numberOfChannels=2] The number of output channels.
 * @param {Number} [bufferSize] A fixed buffer size to use.
 */
var AudioDataAPIDevice = function(audiolet, sampleRate, numberOfChannels,
                                  bufferSize) {
    AbstractAudioletDevice.call(this, audiolet);

    this.sampleRate = sampleRate || 44100.0;
    this.numberOfChannels = numberOfChannels || 2;
    if (bufferSize) {
        this.bufferSize = bufferSize;
        this.autoLatency = false;
    }
    else {
        this.bufferSize = this.sampleRate * 0.02;
        this.autoLatency = true;
    }

    this.output = new Audio();
    this.baseOverflow = null;
    this.overflow = null;
    this.overflowOffset = 0;
    this.writePosition = 0;

    this.output.mozSetup(this.numberOfChannels, this.sampleRate);

    this.started = new Date().valueOf();
    this.interval = setInterval(this.tick.bind(this), 10);
};
extend(AudioDataAPIDevice, AbstractAudioletDevice);

/**
 * Overridden tick function.  Pulls data from the input and writes it to the
 * device
 */
AudioDataAPIDevice.prototype.tick = function() {
    var outputPosition = this.output.mozCurrentSampleOffset();
    // Check if some data was not written in previous attempts
    var numSamplesWritten;
    if (this.overflow) {
        numSamplesWritten = this.output.mozWriteAudio(this.overflow);
        if (numSamplesWritten == 0) return;
        this.writePosition += numSamplesWritten;
        if (numSamplesWritten < this.overflow.length) {
            // Not all the data was written, saving the tail for writing
            // the next time fillBuffer is called
            // Begin broken subarray-of-subarray fix
            this.overflowOffset += numSamplesWritten;
            this.overflow = this.baseOverflow.subarray(this.overflowOffset);
            // End broken subarray-of-subarray fix
            // Uncomment the following line when subarray-of-subarray is
            // sorted
            //this.overflow = this.overflow.subarray(numSamplesWritten);
            return;
        }
        this.overflow = null;
    }

    var samplesNeeded = outputPosition +
        (this.bufferSize * this.numberOfChannels) -
        this.writePosition;

    if (this.autoLatency) {
        var delta = (new Date().valueOf() - this.started) / 1000;
        this.bufferSize = this.sampleRate * delta;
        if (outputPosition) {
            this.autoLatency = false;
        }
    }

    if (samplesNeeded >= this.numberOfChannels) {
        // Samples needed per channel
        samplesNeeded = Math.floor(samplesNeeded / this.numberOfChannels);
        // Request some sound data from the callback function.
        AudioletNode.prototype.tick.call(this, samplesNeeded,
                                         this.getWriteTime());
        var buffer = this.buffer.interleaved();

        // Writing the data.
        numSamplesWritten = this.output.mozWriteAudio(buffer);
        this.writePosition += numSamplesWritten;
        if (numSamplesWritten < buffer.length) {
            // Not all the data was written, saving the tail.
            // Begin broken subarray-of-subarray fix
            this.baseOverflow = buffer;
            this.overflowOffset = numSamplesWritten;
            // End broken subarray-of-subarray fix
            this.overflow = buffer.subarray(numSamplesWritten);
        }
    }
};

/**
 * Get the current output position
 *
 * @return {Number} Output position in samples.
 */
AudioDataAPIDevice.prototype.getPlaybackTime = function() {
    return this.output.mozCurrentSampleOffset() / this.numberOfChannels;
};

/**
 * Get the current write position
 *
 * @return {Number} Write position in samples.
 */
AudioDataAPIDevice.prototype.getWriteTime = function() {
    return this.writePosition / this.numberOfChannels;
};

/**
 * toString
 *
 * @return {String} String representation.
 */
AudioDataAPIDevice.prototype.toString = function() {
    return 'Audio Data API Device';
};
